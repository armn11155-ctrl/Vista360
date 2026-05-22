import { Component } from "react";
import { T } from "../../config/theme";

interface State {
  hasError: boolean;
  msg: string;
}

interface Props {
  label: string;
  children: React.ReactNode;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, msg: "" };

  static getDerivedStateFromError(e: Error): State {
    return { hasError: true, msg: e.message };
  }

  render() {
    if (this.state.hasError)
      return (
        <div style={{ padding: 20, color: T.red, fontSize: 13 }}>
          [{this.props.label}] Error: {this.state.msg}
        </div>
      );
    return this.props.children;
  }
}
