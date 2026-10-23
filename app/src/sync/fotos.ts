// ===========================================================================
//  Sincronização das fotos de produto com o Storage.
//
//  Roda depois de cada sincronização bem-sucedida da conta: envia fotos novas
//  ou trocadas, aponta o produto para o arquivo, baixa as que faltam neste
//  aparelho e apaga da pasta do usuário os arquivos que nada mais usa (exceto os
//  referenciados por itens que ele publicou no catálogo de todos).
// ===========================================================================

import { repos } from "@/data";
import { planejarFotos } from "@/domain/fotos";
import { blobParaDataUri, dataUriParaBlob } from "@/integrations/image";
import { baixarFoto, enviarFoto, listarFotos, removerFotos } from "@/integrations/fotosStorage";
import { fotosPublicadasPor } from "@/integrations/sharedCatalog";
import { assinarStatus, lerStatus, type Conta } from "./accountSync";

let conta: Conta | null = null;
let cancelar: (() => void) | null = null;
let ultimaVista: number | null = null;
let emAndamento: Promise<void> | null = null;

/** cada etapa isolada: uma foto que falha não impede as outras. */
async function tentar(fn: () => Promise<void>) {
  try {
    await fn();
  } catch {
    /* tenta de novo na próxima sincronização */
  }
}

export function sincronizarFotos(): Promise<void> {
  if (emAndamento) return emAndamento;
  emAndamento = (async () => {
    const c = conta;
    if (!c || navigator.onLine === false) return;
    const [produtos, remotos, protegidos] = await Promise.all([
      repos.products.all(),
      listarFotos(c.id),
      fotosPublicadasPor(c.id).catch(() => [] as string[]),
    ]);
    const plano = planejarFotos(c.id, produtos, remotos, protegidos);

    for (const item of plano.enviar) {
      await tentar(async () => {
        const blob = dataUriParaBlob(item.image);
        if (!blob) return;
        await enviarFoto(item.caminho, blob);
        await repos.products.update(item.id, { imagePath: item.caminho });
      });
    }
    for (const item of plano.atualizarCaminho) {
      await tentar(() => repos.products.update(item.id, { imagePath: item.caminho }));
    }
    for (const id of plano.limparCaminho) {
      await tentar(() => repos.products.update(id, { imagePath: null }));
    }
    for (const item of plano.baixar) {
      await tentar(async () => {
        const uri = await blobParaDataUri(await baixarFoto(item.caminho));
        if (uri) await repos.products.update(item.id, { image: uri });
      });
    }
    await tentar(() => removerFotos(plano.remover));
  })()
    .catch(() => {
      /* listagem falhou (rede): tenta na próxima sincronização */
    })
    .finally(() => {
      emAndamento = null;
    });
  return emAndamento;
}

export function iniciarFotos(c: Conta) {
  pararFotos();
  conta = c;
  ultimaVista = lerStatus().ultimaSync;
  cancelar = assinarStatus(() => {
    const s = lerStatus();
    if (s.fase === "ocioso" && s.ultimaSync !== ultimaVista) {
      ultimaVista = s.ultimaSync;
      void sincronizarFotos();
    }
  });
  void sincronizarFotos();
}

export function pararFotos() {
  cancelar?.();
  cancelar = null;
  conta = null;
}
