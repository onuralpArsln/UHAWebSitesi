# Page Order Management System

## Overview

The UHA News CMS includes a comprehensive page layout management system that allows administrators to control the order and arrangement of widgets on the homepage through an intuitive drag-and-drop interface.

## Features

### Visual Widget Management
- **Drag-and-Drop Interface**: Reorder homepage widgets by dragging table rows
- **Real-Time Preview**: See the new order immediately in the CMS
- **Persistent Changes**: Save button commits changes to the database
- **Live Updates**: Homepage reflects new order without server restart

### Developer Tools
- **Terminal Logging**: Widget list printed to terminal on save
- **Log File**: All layout changes recorded in `layout-changes.log` with timestamps
- **Debug Mode**: Browser console shows detailed client-side process

## Architecture

### Data Flow

```
User Drags Widget
    ↓
DOM Updates (Client)
    ↓
User Clicks Save
    ↓
PUT /cms/layouts/homepage
    ↓
Server Logs Widget List
    ↓
dataService.updateHomepageLayout()
    ↓
Database Updated
    ↓
Response to Client
    ↓
Homepage Renders New Order
```

### Components

#### Server-Side (`server/routes/cms.js`)
```javascript
router.put('/layouts/homepage', async (req, res) => {
  const { layout } = req.body;
  
  // Log to terminal
  console.error('Widget List:', layout.map(w => w.type));
  
  // Save to file
  fs.appendFileSync('layout-changes.log', ...);
  
  // Persist to database
  const updated = dataService.updateHomepageLayout(layout);
  
  res.json(updated);
});
```

#### Client-Side (`public/cms/js/cms-app.js`)
```javascript
class CMSDashboard {
  initializeLayoutManager() {
    // Set up drag-and-drop event listeners
    this.layoutTable.addEventListener('dragstart', ...);
    this.layoutTable.addEventListener('dragover', ...);
    this.layoutTable.addEventListener('drop', ...);
  }
  
  async saveLayout() {
    // Collect new order from DOM
    const newOrder = Array.from(rows).map(row => {
      const index = parseInt(row.dataset.index);
      return this.state.homepageLayout[index];
    });
    
    // Send to server
    await fetch('/cms/layouts/homepage', {
      method: 'PUT',
      body: JSON.stringify({ layout: newOrder })
    });
  }
}
```

#### Template (`templates/cms/components/layout-list.njk`)
```html
<table data-cms="layout-table">
  <tbody>
    {% for widget in layout %}
    <tr draggable="true" data-index="{{ loop.index0 }}">
      <td class="layout-order">{{ loop.index }}</td>
      <td>{{ widget.type }}</td>
      <td>{{ widget.config | dump }}</td>
    </tr>
    {% endfor %}
  </tbody>
</table>
```

## Usage Guide

### For Administrators

1. **Access the Layout Manager**
   - Navigate to CMS Dashboard
   - Click "Sayfa Düzeni" in the sidebar

2. **Reorder Widgets**
   - Click and hold on any widget row
   - Drag to the desired position
   - Release to drop

3. **Save Changes**
   - Click "Değişiklikleri Kaydet" button
   - Wait for success notification
   - Reload homepage to verify

### For Developers

#### Monitoring Changes

**Terminal Output:**
```bash
npm run dev

# When save button is clicked:
🔷 CMS Request: PUT /layouts/homepage
🟢 PUT /layouts/homepage endpoint HIT!

========================================
📋 SAYFA DÜZENİ GÜNCELLENDİ
⏰ Zaman: 2025-11-21T14:22:00.000Z
========================================
Widget Sayısı: 7

Widget Listesi:

1. Widget:
   Tip: carousel
   Config: {
     "autoplay": true,
     "interval": 5000
   }

2. Widget:
   Tip: hero-title
   ...
========================================
```

**Log File:**
```bash
cat layout-changes.log
# or
tail -f layout-changes.log  # Live monitoring
```

#### Browser Console
```javascript
// Client-side debug logs
🔵 Save Layout button clicked!
🔵 Found rows: 7
🔵 New order: ['carousel', 'hero-title', 'featured-news-grid', ...]
🔵 Sending PUT request to /cms/layouts/homepage...
🔵 Response status: 200
```

## Technical Implementation

### Route Ordering (Critical)

⚠️ **Important:** The `/layouts/homepage` route MUST be defined BEFORE `/layouts/:id` in Express routing.

```javascript
// ✅ CORRECT ORDER
router.put('/layouts/homepage', ...);  // Specific route first
router.put('/layouts/:id', ...);       // Generic route second

// ❌ WRONG ORDER (will not work)
router.put('/layouts/:id', ...);       // Generic catches everything
router.put('/layouts/homepage', ...);  // Never reached
```

### Drag-and-Drop Events

| Event | Purpose |
|-------|---------|
| `dragstart` | Set dragged element, add visual feedback |
| `dragover` | Prevent default, set drop effect |
| `drop` | Update DOM order, refresh numbering |
| `dragend` | Remove visual feedback, cleanup |

### State Management

```javascript
// Widget state stored in CMSDashboard
this.state.homepageLayout = [
  { type: 'carousel', config: {...} },
  { type: 'hero-title', config: {...} },
  ...
];

// After drag-and-drop, state is updated
// data-index attributes are reassigned for subsequent saves
```

## Troubleshooting

### Logs Not Appearing in Terminal

**Issue:** Nodemon buffers stdout  
**Solution:** Using `console.error()` which writes to unbuffered stderr

### Route Not Matching

**Issue:** Generic `/layouts/:id` catching specific route  
**Solution:** Move specific routes before parameterized routes

### Drag Not Working

**Check:**
- Rows have `draggable="true"` attribute
- Event listeners are attached in `initializeLayoutManager()`
- `layoutTable` element exists in DOM

## Future Enhancements

- [ ] Add widget enable/disable toggle
- [ ] Support for adding new widgets from CMS
- [ ] Widget configuration editor
- [ ] Undo/redo functionality
- [ ] Preview mode before saving
- [ ] Multi-page layout support

## Related Files

- [cms.js](file:///home/onuralp/project/UHAWebSitesi/server/routes/cms.js) - Server routes
- [cms-app.js](file:///home/onuralp/project/UHAWebSitesi/public/cms/js/cms-app.js) - Client logic
- [layout-list.njk](file:///home/onuralp/project/UHAWebSitesi/templates/cms/components/layout-list.njk) - UI component
- [data-service.js](file:///home/onuralp/project/UHAWebSitesi/server/services/data-service.js) - Data persistence
