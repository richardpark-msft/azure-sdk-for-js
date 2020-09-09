﻿exports.wifi = {
  "@id": "dtmi:samples:Wifi;1",
  "@type": "Interface",
  "@context": "dtmi:dtdl:context;2",
  displayName: "Wifi",
  contents: [
    {
      "@type": "Property",
      name: "RouterName",
      schema: "string"
    },
    {
      "@type": "Property",
      name: "Network",
      schema: "string"
    }
  ]
};
