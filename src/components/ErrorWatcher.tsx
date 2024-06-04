import React, { ErrorInfo } from "react";
import { notifyServer } from "./notify";

interface ErrorWatcherProps {
  children: React.ReactNode;
}

class ErrorWatcher extends React.Component<ErrorWatcherProps> {
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.log("Error occurred", error, errorInfo);
    notifyServer({
      type: "error",
      message: error.message,
      stack: error.stack,
      errorInfo,
    });
  }

  render() {
    return this.props.children;
  }
}

export default ErrorWatcher;