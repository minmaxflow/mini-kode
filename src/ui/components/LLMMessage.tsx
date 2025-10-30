import InkMarkdown from "./InkMarkdown";

export interface LLMMessageProps {
  markdown: string;
}

export function LLMMessage({ markdown }: LLMMessageProps) {
  return <InkMarkdown>{markdown}</InkMarkdown>;
}

export default LLMMessage;
