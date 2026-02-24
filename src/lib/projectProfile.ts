import profileJson from "@/data/project-iov-profile.json";
import { dictionary } from "@/lib/storytellingGame";
import type { ProjectProfile, ProjectResourceLink } from "@/types/storytelling";

export const projectProfile = profileJson as ProjectProfile;

const fallbackResourceLabels = new Map(
  dictionary.core_spine.map((node) => [node.id, node.label])
);

dictionary.extended_artifacts.forEach((artifact) => {
  fallbackResourceLabels.set(artifact.id, artifact.label);
});

dictionary.variable_vocabulary.distribution.forEach((modifier) => {
  fallbackResourceLabels.set(modifier.id, modifier.label);
});

export const getProjectResourceLabel = (resourceKey: string): string =>
  fallbackResourceLabels.get(resourceKey) ?? resourceKey;

export const getProjectLinks = (resourceKey: string | null | undefined): ProjectResourceLink[] => {
  if (!resourceKey) return projectProfile.default_links;
  return projectProfile.resource_links[resourceKey] ?? projectProfile.default_links;
};
