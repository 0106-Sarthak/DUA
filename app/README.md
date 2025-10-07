# DUA Automation App – Knowledge Transfer Guide

## Project Purpose

The DUA Automation App streamlines data extraction, report generation, and workflow automation for Tata Motors CRM DMS and similar platforms. Built with Node.js, Electron, and Puppeteer, it automates web interactions, produces reports, and uploads results efficiently.

## Architecture Overview

- **Electron**: Provides the desktop shell and user interface.
- **Node.js**: Handles backend logic, file management, scheduling, and API communication.
- **Puppeteer**: Powers browser automation for web-based workflows.
- **Action Sheets**: JSON files that define step-by-step automation tasks.
- **Data Storage**: Organizes reports, logs, and configuration files by dealer/location.

## Key Folders & Files

- `main/automation.js`: Orchestrates automation workflows.
- `main/automation/`: Contains modular scripts for browser actions, login, and workflow steps.
- `action-sheets/`: Stores JSON files describing automation steps for each workflow.
- `data/reports/`: Holds output reports, organized by dealer and location.
- `data/config/config.json`: System configuration settings.
- `data/config/user-input.xlsx`: User credentials and input data.
- `renderer/`: Electron frontend codebase.
- `services/`: API and database service logic.
- `utils/`: Utility functions (date handling, file operations, logging).

---
