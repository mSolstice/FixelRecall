import {
  createNormalizedRequest,
  createProviderMetadata,
  requestId,
  type NormalizedRequest
} from "@context-diet/core";

export function createAnthropicAdapterRequest(id: string): NormalizedRequest {
  return createNormalizedRequest({
    id: requestId(id),
    provider: "anthropic",
    messages: [],
    providerMetadata: createProviderMetadata("anthropic", "anthropic_messages")
  });
}
