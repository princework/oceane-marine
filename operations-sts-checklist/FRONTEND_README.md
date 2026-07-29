# STS Checklist Frontend

## Overview
This is the frontend application for managing STS (Ship-to-Ship) Checklist forms. It provides a dashboard to view all forms, list submitted entries, view form details, and edit forms.

## Features

### 1. Dashboard (`/`)
- Displays all available forms in a table structure
- Each form has a "View List" button
- Shows form number and title

### 2. Form List Page (`/forms/[formPath]/list`)
- Shows all submitted forms for a specific form type
- Year-based filtering
- Status badges for each form
- View and Edit buttons for each entry

### 3. View Form Page (`/forms/[formPath]/view/[id]`)
- Displays complete form data in a readable format
- Shows form metadata (ID, creation date, status)
- Edit button to navigate to edit page

### 4. Edit Form Page (`/forms/[formPath]/edit/[id]`)
- Allows editing of form data
- Dynamic form field rendering based on data structure
- Supports text, number, date, textarea, checkbox, and select fields
- Updates form with version increment
- Redirects to view page after successful update

## Project Structure

```
src/
├── app/
│   ├── page.js                          # Dashboard (main page)
│   ├── forms/
│   │   └── [formPath]/
│   │       ├── list/
│   │       │   └── page.js              # List all forms of a type
│   │       ├── view/
│   │       │   └── [id]/
│   │       │       └── page.js           # View single form
│   │       └── edit/
│   │           └── [id]/
│   │               └── page.js          # Edit single form
│   └── layout.js                        # Root layout
└── lib/
    └── config.js                        # API configuration and form mappings
```

## Configuration

### API Base URL
Update the API base URL in `src/lib/config.js`:

```javascript
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000/api/operations/sts-checklist';
```

Or set the environment variable:
```bash
NEXT_PUBLIC_API_BASE_URL=http://your-backend-url/api/operations/sts-checklist
```

## Available Forms

1. OPS-OFD-001 - Before Operation Commence
2. OPS-OFD-001A - Ship Standard Questionnaire
3. OPS-OFD-002 - Before Run In & Mooring
4. OPS-OFD-003 - Before Cargo Transfer (3A & 3B)
5. OPS-OFD-004 - Pre-Transfer Agreements (4A-4F)
6. OPS-OFD-005 - During Transfer (5A-5C)
7. OPS-OFD-005B - Before Disconnection & Unmooring
8. OPS-OFD-005C - Terminal Transfer Checklist
9. OPS-OFD-028 - Personnel Transfer Basket Checklist
10. OPS-OFD-009 - Mooring Master's Job Report
11. OPS-OFD-011 - STS Standing Order
12. OPS-OFD-014 - Equipment Checklist
13. OPS-OFD-015 - Hourly Quantity Log
14. OPS-OFD-018 - STS Timesheet
15. OPS-OFD-029 - Mooring Master Expense Sheet

## API Endpoints Used

- `GET /api/operations/sts-checklist/[formPath]/list?year=2024` - List all forms
- `POST /api/operations/sts-checklist/[formPath]/[id]/update` - Update form

## Running the Application

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Styling

The application uses Tailwind CSS for styling with a dark theme (gray-900 background). All components follow a consistent design pattern.

## Notes

- The frontend expects the backend API to be running and accessible
- CORS must be properly configured on the backend for external folder access
- Form data is dynamically rendered based on the structure returned from the API
- Edit functionality automatically handles nested objects and arrays
