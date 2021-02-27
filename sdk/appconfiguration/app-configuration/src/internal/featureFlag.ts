import { FeatureFlag, GetConfigurationSettingResponse } from "../models";

/**
 * @param key
 * @internal
 */
export function formatAsFeatureFlag(key: string): string {
  if (key.match(/^\.appconfig\.featureflag/)) {
    return key;
  }

  return `.appconfig.featureflag/${key}`;
}

/**
 * @param setting
 * @internal
 */
export function convertToFeatureFlag(
  setting: GetConfigurationSettingResponse
): GetConfigurationSettingResponse & FeatureFlag {
  if (setting.value == null) {
    throw new Error(`${setting.key} is not a feature flag or has invalid content.`);
  }

  const featureFlag = JSON.parse(setting.value);

  return {
    ...setting,
    // TODO: actually format this.
    ...featureFlag,
    kind: "FeatureFlag"
  };
}
