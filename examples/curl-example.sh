#!/bin/bash
# Agent Protocol v0.1 - cURL Example
# 
# This example shows how to invoke an agent skill using cURL

# Configuration
SKILL_NAME="figma-export"
INTENT="export_design"
API_KEY="your-api-key-here"

# Build the request
REQUEST=$(cat <<EOF
{
  "intent": "${INTENT}",
  "skill": "${SKILL_NAME}",
  "params": {
    "file_key": "b1bGJwFilTaZH97BwFoUdX",
    "format": "png"
  },
  "context": {
    "user": "user-123",
    "session": "session-456"
  },
  "expectOutput": "file"
}
EOF
)

# Send the request
RESPONSE=$(curl -s -X POST "http://agent-server/skills/invoke" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${API_KEY}" \
  -d "${REQUEST}")

# Parse the response
STATUS=$(echo "${RESPONSE}" | jq -r '.status')

if [ "${STATUS}" = "success" ]; then
  echo "✅ Skill executed successfully"
  OUTPUT_URL=$(echo "${RESPONSE}" | jq -r '.output.url')
  echo "Output: ${OUTPUT_URL}"
else
  echo "❌ Skill execution failed"
  ERROR_CODE=$(echo "${RESPONSE}" | jq -r '.error.code')
  ERROR_MSG=$(echo "${RESPONSE}" | jq -r '.error.message')
  echo "Error: ${ERROR_CODE} - ${ERROR_MSG}"
  
  if [ "$(echo "${RESPONSE}" | jq -r '.error.recoverable')" = "true" ]; then
    SUGGESTION=$(echo "${RESPONSE}" | jq -r '.error.suggestion')
    echo "Fix: ${SUGGESTION}"
  fi
fi
