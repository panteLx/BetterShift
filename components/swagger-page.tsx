import SwaggerUI from "swagger-ui-react"
import "swagger-ui-react/swagger-ui.css"

function ApiDocs() {
  return (
    <SwaggerUI
      url="http://localhost:5000/openapi.json"
    />
  );
}

export default ApiDocs;