/**
 * Copies text to the clipboard with full fallback support for insecure HTTP contexts
 * (e.g. accessing via LAN IP like http://172.16.3.215:1947/).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. Try modern Clipboard API if supported and in a secure context
  if (typeof window !== 'undefined' && window.isSecureContext && navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn("navigator.clipboard.writeText failed, attempting execCommand fallback:", err);
    }
  }

  // 2. Fallback using temporary textarea and document.execCommand('copy') for insecure contexts (HTTP)
  if (typeof document !== 'undefined') {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.width = "2em";
      textArea.style.height = "2em";
      textArea.style.padding = "0";
      textArea.style.border = "none";
      textArea.style.outline = "none";
      textArea.style.boxShadow = "none";
      textArea.style.background = "transparent";
      textArea.style.opacity = "0";
      textArea.style.pointerEvents = "none";
      textArea.setAttribute("readonly", "");

      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      textArea.setSelectionRange(0, text.length);

      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      console.error("Fallback document.execCommand('copy') failed:", err);
      return false;
    }
  }

  return false;
}
