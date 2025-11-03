import { Box, Text } from "ink";

import { ConfigManager } from "../../config";
import { getCurrentTheme } from "../theme";

/**
 * Component to display current LLM configuration information
 * Shows baseURL, model, and masked API key
 */
export function LLMInfoDisplay() {
  let llmConfig;
  try {
    llmConfig = ConfigManager.load().llm;
  } catch (error) {
    // If config loading fails, show error message
    return (
      <Box flexDirection="column" marginTop={1}>
        <Text color={getCurrentTheme().error}>⚠️ Configuration Error</Text>
        <Text color={getCurrentTheme().error}>
          Failed to load LLM configuration
        </Text>
      </Box>
    );
  }

  // Mask API key for security - show first 4 and last 4 characters
  const maskApiKey = (apiKey: string) => {
    if (!apiKey || apiKey.length < 8) {
      return "";
    }
    return `${apiKey.slice(0, 4)}${"•".repeat(apiKey.length - 8)}${apiKey.slice(-4)}`;
  };

  // Extract provider name from baseURL for better readability
  const getProviderName = (baseURL: string) => {
    if (baseURL.includes("deepseek.com")) return "DeepSeek";
    if (baseURL.includes("openai.com")) return "OpenAI";
    if (baseURL.includes("bigmodel.cn")) return "GLM (Zhipu AI)";
    return "Custom";
  };

  const providerName = getProviderName(llmConfig.baseURL);
  const maskedApiKey = maskApiKey(llmConfig.apiKey);

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box flexDirection="row" gap={1}>
        <Text color={getCurrentTheme().secondary}>LLM Provider:</Text>
        <Text color={getCurrentTheme().accent}>{providerName}</Text>
      </Box>

      <Box flexDirection="row" gap={1}>
        <Text color={getCurrentTheme().secondary}>Base URL:</Text>
        <Text>{llmConfig.baseURL}</Text>
      </Box>

      <Box flexDirection="row" gap={1}>
        <Text color={getCurrentTheme().secondary}>Model:</Text>
        <Text>{llmConfig.model}</Text>
      </Box>

      <Box flexDirection="row" gap={1}>
        <Text color={getCurrentTheme().secondary}>API Key:</Text>
        <Text color={getCurrentTheme().success}>{maskedApiKey}</Text>
      </Box>

      {!llmConfig.apiKey && (
        <Box flexDirection="row" marginTop={1}>
          <Text color={getCurrentTheme().warning} bold>
            ⚠️ No API key configured
          </Text>
        </Box>
      )}

      {llmConfig.model !== llmConfig.planModel && (
        <Box flexDirection="row" gap={1}>
          <Text color={getCurrentTheme().secondary} bold>
            Plan Model:
          </Text>
          <Text>{llmConfig.planModel}</Text>
        </Box>
      )}
    </Box>
  );
}
