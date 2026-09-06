// Registra um IndexedDB em memória (fake-indexeddb) para os testes de schema/migração.
// Importado no topo de cada *.test.ts que toca o Dexie.
import "fake-indexeddb/auto";

// `structuredClone` é usado pelo fake-indexeddb; Node 22 já traz global.
// `crypto.randomUUID` também. Nada mais a fazer.
