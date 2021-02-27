// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {
  AppConfigurationClient,
  FeatureFlag,
  isFeatureFlag,
  isPercentageClientFilter,
  isTargetingClientFilter,
  isTimeWindowClientFilter
} from "../../src";

describe.only("featureFlags", () => {
  let appConfigClient: AppConfigurationClient;

  before(function() {
    // recorder = startRecorder(this);
    appConfigClient = new AppConfigurationClient(process.env.APPCONFIG_CONNECTION_STRING!);
  });

  describe.only("get ideas", () => {
    it("Idea 1: get feature flag with an additional 'options' flag to tell me it's a feature flag. Uses typeguard.", async () => {
      const featureFlagMaybe = await appConfigClient.getConfigurationSetting({
        kind: "FeatureFlag",
        // needed to get some idea on how to format the name (ie, the actual name of the feature flga is `.appconfig.featureflag/testFeatureFlag`)
        key: "testFeatureFlag"
      });

      if (isFeatureFlag(featureFlagMaybe)) {
        console.log(`featureFlagMaybe: `, featureFlagMaybe);
        sharedClientFilterUsageCode(featureFlagMaybe);
      } else {
        // hm...at least this "degrades" to still being usable as ConfigurationSetting
        throw new Error("Somehow this wasn't actually a feature flag. Maybe I was incorrect!");
      }
    });

    it("Idea 2: get feature flag with a specific method (no longer requires typeguard)", async () => {
      const featureFlagDefinitely = await appConfigClient.getFeatureFlag({
        key: "testFeatureFlag"
      });

      sharedClientFilterUsageCode(featureFlagDefinitely);
    });
  });

  it("save feature flag", () => {});

  it("make slight changes to feature flag", () => {});
});

// NOTE: all of the ideas will have some form of this kind of "type" discovery
// to figure out what's going on.
function sharedClientFilterUsageCode(featureFlagMaybe: FeatureFlag) {
  // NOTE: using filters is a bit awkward no matter what approach we use.
  for (const filter of featureFlagMaybe.conditions.client_filters) {
    if (isPercentageClientFilter(filter)) {
      console.log(`Percentage based filter:`);

      // TODO: I'm still unsure what is meant to be done here.
      for (const percentValueName in filter.parameters) {
        console.log(
          `Percent value name ${percentValueName} = ${filter.parameters[percentValueName]}`
        );
      }
    } else if (isTargetingClientFilter(filter)) {
      console.log(`Audience for this filter:`);

      for (const group of filter.parameters.Audience.Groups) {
        console.log(`Group: ${group.Name}, rollout percentage: ${group.RolloutPercentage}`);
      }

      for (const user of filter.parameters.Audience.Users) {
        console.log(`User: ${user}`);
      }
    } else if (isTimeWindowClientFilter(filter)) {
      console.log(`Time window: ${filter.parameters.End} to ${filter.parameters.End}`);
    } else {
      console.log(`Unknown filter: `, filter);
    }
  }
}
