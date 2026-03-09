#!/usr/bin/env python3
"""
Agent Protocol v0.1 - Python Example

This example shows how to invoke an agent skill using Python.
"""

import json
import requests
from typing import Any, Dict, Optional

class AgentProtocolClient:
    """Client for invoking agent skills using Agent Protocol v0.1"""
    
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url
        self.api_key = api_key
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        })
    
    def invoke(
        self,
        skill: str,
        intent: str,
        params: Dict[str, Any],
        expect_output: str = "structured"
    ) -> Dict[str, Any]:
        """
        Invoke an agent skill.
        
        Args:
            skill: Skill name (e.g., "figma-export")
            intent: Intent name (e.g., "export_design")
            params: Parameters for the skill
            expect_output: Expected output type ("file", "structured", "text")
        
        Returns:
            Response dictionary with status and output
        """
        request = {
            "intent": intent,
            "skill": skill,
            "params": params,
            "context": {
                "user": "user-123",
                "session": "session-456"
            },
            "expectOutput": expect_output
        }
        
        response = self.session.post(
            f"{self.base_url}/skills/invoke",
            json=request
        )
        response.raise_for_status()
        
        result = response.json()
        
        if result["status"] == "error":
            error = result["error"]
            raise AgentProtocolError(
                code=error["code"],
                message=error["message"],
                recoverable=error.get("recoverable", False),
                suggestion=error.get("suggestion")
            )
        
        return result
    
    def discover_skills(self) -> Dict[str, Any]:
        """Discover available skills."""
        response = self.session.get(f"{self.base_url}/skills")
        response.raise_for_status()
        return response.json()


class AgentProtocolError(Exception):
    """Error from agent skill execution."""
    
    def __init__(
        self,
        code: str,
        message: str,
        recoverable: bool = False,
        suggestion: Optional[str] = None
    ):
        self.code = code
        self.message = message
        self.recoverable = recoverable
        self.suggestion = suggestion
        super().__init__(message)


# Example usage
if __name__ == "__main__":
    client = AgentProtocolClient(
        base_url="http://localhost:8080",
        api_key="your-api-key-here"
    )
    
    try:
        # Invoke a skill
        result = client.invoke(
            skill="figma-export",
            intent="export_design",
            params={
                "file_key": "b1bGJwFilTaZH97BwFoUdX",
                "format": "png"
            },
            expect_output="file"
        )
        
        print("✅ Success!")
        print(f"Output: {result['output']}")
        
    except AgentProtocolError as e:
        print(f"❌ Error: {e.code} - {e.message}")
        if e.recoverable and e.suggestion:
            print(f"💡 Fix: {e.suggestion}")
