/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for
 * license information.
 *
 * Code generated by Microsoft (R) AutoRest Code Generator.
 * Changes may cause incorrect behavior and will be lost if the code is
 * regenerated.
 */

import * as coreHttp from "@azure/core-http";

const packageName = "@azure/search-documents";
const packageVersion = "1.0.0-preview.3";

export class SearchServiceClientContext extends coreHttp.ServiceClient {
  apiVersion: string;
  endpoint: string;
  credentials: coreHttp.TokenCredential | coreHttp.ServiceClientCredentials;

  /**
   * Initializes a new instance of the SearchServiceClientContext class.
   * @param apiVersion Client Api Version.
   * @param endpoint The endpoint URL of the search service.
   * @param credentials Subscription credentials which uniquely identify client subscription.
   * @param [options] The parameter options
   */
  constructor(
    credentials: coreHttp.TokenCredential | coreHttp.ServiceClientCredentials,
    apiVersion: string,
    endpoint: string,
    options?: coreHttp.ServiceClientOptions
  ) {
    if (apiVersion == undefined) {
      throw new Error("'apiVersion' cannot be null.");
    }
    if (endpoint == undefined) {
      throw new Error("'endpoint' cannot be null.");
    }
    if (credentials == undefined) {
      throw new Error("'credentials' cannot be null.");
    }

    if (!options) {
      options = {};
    }

    if (!options.userAgent) {
      const defaultUserAgent = coreHttp.getDefaultUserAgentValue();
      options.userAgent = `${packageName}/${packageVersion} ${defaultUserAgent}`;
    }

    super(credentials, options);

    this.baseUri = "{endpoint}";
    this.requestContentType = "application/json; charset=utf-8";
    this.apiVersion = apiVersion;
    this.endpoint = endpoint;
    this.credentials = credentials;
  }
}
