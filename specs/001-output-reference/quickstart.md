# Quickstart: Output Reference & Trigger Node UX Improvements

**Feature Branch**: `001-output-reference`
**Date**: 2026-01-07

---

## Overview

This guide demonstrates how to use the new output reference features in the workflow editor.

---

## Scenario 1: Using Previous Outputs in a Node Configuration

### Goal
Configure an API Call node to use data from an upstream User Intent trigger.

### Steps

1. **Create a User Intent trigger** with parameters:
   - Name: "Get Weather"
   - Parameters:
     - `city` (string, required): "City name for weather lookup"
     - `units` (string, optional): "Temperature units (celsius/fahrenheit)"

2. **Add an API Call node** connected to the trigger

3. **Open the API Call configuration**:
   - Click the API Call node to open the edit modal

4. **Use the "Use Previous Outputs" component**:
   - Locate the "Use Previous Outputs" section in the modal
   - **Source Node dropdown**: Shows `get_weather` (the trigger's slug)
   - **Output Field dropdown**: Shows available fields:
     - `type` (string) - Static
     - `triggered` (boolean) - Static
     - `toolName` (string) - Static
     - `city` (string) - Dynamic - "City name for weather lookup"
     - `units` (string) - Dynamic - "Temperature units"
   - Select `city`
   - Click **Copy** button

5. **Paste into API URL field**:
   - The clipboard now contains: `{{ get_weather.city }}`
   - Paste into the URL: `https://api.weather.com/v1/current?city={{ get_weather.city }}`

### Expected Result
- The API Call URL contains a human-readable reference
- When the flow executes, `{{ get_weather.city }}` is replaced with the actual city value

---

## Scenario 2: Viewing Trigger Node Schema

### Goal
Understand what outputs are available from a User Intent trigger.

### Steps

1. **Select a User Intent trigger** on the canvas

2. **Open the Schema tab** in the node edit modal

3. **View Input Schema section**:
   - Displays: "No input - triggers start the flow"
   - Clear indication that trigger nodes have no input

4. **View Output Schema section**:
   - **Static Fields** (marked with badge):
     - `type`: string (always "trigger")
     - `triggered`: boolean
     - `toolName`: string
   - **Dynamic Fields** (marked with badge):
     - Fields from user-defined parameters
     - Each shows name, type, description, and required status

### Expected Result
- Users clearly understand the difference between static and dynamic outputs
- Users know exactly what data will be available to downstream nodes

---

## Scenario 3: Toggling Trigger Active State

### Goal
Enable or disable a trigger's MCP tool exposure.

### Steps

1. **Open the Edit User Intent modal**

2. **Locate the "Active" toggle switch**:
   - Found in the MCP Tool Configuration section
   - Toggle is ON by default (trigger is active)

3. **Toggle OFF** to deactivate:
   - Switch moves to OFF position
   - Trigger will not be exposed as an MCP tool
   - Trigger can still be used within the flow editor for testing

4. **Toggle ON** to activate:
   - Switch moves to ON position
   - Trigger is exposed as an MCP tool
   - External systems can invoke this trigger

### Expected Result
- Clear visual feedback: ON = active (exposed), OFF = inactive (not exposed)
- No confusion about what the toggle controls

---

## Scenario 4: Understanding Node Slugs

### Goal
See how node slugs work for human-readable references.

### Steps

1. **Create multiple nodes**:
   - User Intent: "Weather Lookup" → slug: `weather_lookup`
   - API Call: "Fetch Data" → slug: `fetch_data`
   - Return: "Response" → slug: `response`

2. **View slugs in "Use Previous Outputs"**:
   - When configuring the Return node
   - Source dropdown shows: `weather_lookup`, `fetch_data`
   - (Not UUIDs like `abc-123-def`)

3. **Rename a node**:
   - Change "Weather Lookup" to "City Weather"
   - Slug automatically updates to: `city_weather`
   - Existing references `{{ weather_lookup.city }}` are migrated to `{{ city_weather.city }}`

### Expected Result
- All references use human-readable slugs
- References update when nodes are renamed
- Users can understand reference strings without lookup

---

## Scenario 5: Referencing Nested Output Fields

### Goal
Reference a deeply nested field from an API response.

### Steps

1. **Set up an API Call node** that returns nested data:
   ```json
   {
     "response": {
       "data": {
         "weather": {
           "temperature": 72,
           "conditions": "sunny"
         }
       }
     }
   }
   ```

2. **Open a downstream node's configuration**

3. **Use "Use Previous Outputs"**:
   - Select the API Call node
   - Output fields show flattened paths:
     - `response.data.weather.temperature` (number)
     - `response.data.weather.conditions` (string)
   - Select `response.data.weather.temperature`
   - Click **Copy**

4. **Result**:
   - Clipboard contains: `{{ api_call_1.response.data.weather.temperature }}`

### Expected Result
- Nested paths are fully expanded in the dropdown
- Users can reference any depth of nesting
- Full path is included in the copied reference

---

## Validation Scenarios

### Invalid Reference Handling

| Scenario | Expected Behavior |
|----------|-------------------|
| Node deleted after reference created | Reference shown as error in configuration |
| Field removed from schema | Validation warning on the referencing node |
| Typo in manual reference | Error during execution with helpful message |

### Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Two nodes with same name | Slugs differentiated: `api_call_1`, `api_call_2` |
| Node with special characters in name | Sanitized to valid slug: "Get User Info!" → `get_user_info` |
| Empty output schema | "No outputs available" message in dropdown |
| Schema pending/unknown | "Schema unavailable - refresh" option shown |

---

## Quick Reference

### Output Reference Syntax
```
{{ nodeSlug.propertyPath }}
```

**Examples**:
- `{{ user_intent_1.city }}`
- `{{ api_call.response.status }}`
- `{{ fetch_weather.data.temperature }}`

### Slug Format
- Lowercase letters, numbers, underscores only
- Starts with letter
- Auto-generated from node name
- Unique within flow (suffix added if needed)
