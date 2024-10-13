import { useState } from "react";

export function useCopyToClipboard() {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
        })
        .catch((_error) => {
          setCopied(false);
        });
    } else {
      // Fallback for older browsers.
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed"; // Prevent scrolling to bottom.
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        const successful = document.execCommand("copy");
        setCopied(successful);
        setTimeout(() => setCopied(false), 2000);
      } catch (_error) {
        setCopied(false);
      }
      document.body.removeChild(textArea);
    }
  };

  return { copied, copyToClipboard };
}
