"use client";

import SwaggerUI from "swagger-ui-react";

export default function ApiDocs() {
  return (
    <SwaggerUI
      url="openapi.json"
    />
  );
}