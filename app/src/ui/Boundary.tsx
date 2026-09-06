import { Component, type ErrorInfo, type ReactNode } from "react";

// Error boundary — isola a queda de uma tela sem derrubar o app inteiro.
// Portado do `Boundary` do MercadoDoCasal.html.

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}
interface State {
  erro: Error | null;
}

export class Boundary extends Component<Props, State> {
  state: State = { erro: null };

  static getDerivedStateFromError(erro: Error): State {
    return { erro };
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    console.error("Boundary capturou:", erro, info.componentStack);
  }

  render() {
    if (this.state.erro) {
      return (
        this.props.fallback ?? (
          <div className="m-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            <p className="mb-2 font-semibold">Algo quebrou nesta tela.</p>
            <p className="mb-3 text-red-600">{this.state.erro.message}</p>
            <button
              onClick={() => this.setState({ erro: null })}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-white"
            >
              Tentar de novo
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
