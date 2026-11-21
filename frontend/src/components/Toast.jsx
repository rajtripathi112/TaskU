import { useEffect } from "react";

function Toast({ message, onDismiss }) {
  useEffect(() => {
    if (!message) return undefined;
    const timeout = window.setTimeout(onDismiss, 2200);
    return () => window.clearTimeout(timeout);
  }, [message, onDismiss]);

  if (!message) return null;
  return <div className="toast" role="status">{message}</div>;
}

export default Toast;
