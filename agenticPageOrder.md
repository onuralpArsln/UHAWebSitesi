# Page Order Management System

## Overview

The UHA News CMS includes a comprehensive page layout management system that allows administrators to control the order and arrangement of widgets on the homepage through an intuitive drag-and-drop interface.

## Features

### Visual Widget Management
- **Drag-and-Drop Interface**: Reorder homepage widgets by dragging table rows
- **Dynamic Category Dropdowns**: Category-feed widgets show live category selection with auto-updates
- **Real-Time Preview**: See the new order immediately in the CMS
- **Persistent Changes**: Save button commits changes to the database
- **Live Updates**: Homepage reflects new order without server restart

### Developer Tools
- **Terminal Logging**: Widget list printed to terminal on save
- **Log File**: All layout changes recorded in `layout-changes.log` with timestamps
- **Debug Mode**: Browser console shows detailed client-side process

### Category Management Integration
- **Dynamic Category Dropdowns**: Automatically populate with available categories
- **Auto-Update**: Dropdowns refresh when categories are added/deleted
- **Backward Compatibility**: Handles both old (`slug`) and new (`categorySlug`) data formats
- **Smart Defaults**: Auto-selects first available category if configured category is deleted

## Architecture

### Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER INTERACTIONS                             │
├─────────────────────────────────────────────────────────────────┤
│  1. Drag Widget (Reorder)                                       │
│  2. Modify Config (Checkbox/Input/Select)                       │
│  3. Click Save Button                                           │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENT-SIDE (cms-app.js)                      │
├─────────────────────────────────────────────────────────────────┤
│  • Drag Events → DOM Reorder → updateLayoutOrder()             │
│  • Config Events → updateWidgetConfig() → state.homepageLayout  │
│  • Save Button → saveLayout()                                   │
│    - Collects current DOM order                                │
│    - Maps to state.homepageLayout (with configs)               │
│    - Sends PUT /cms/layouts/homepage                           │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    SERVER-SIDE (cms.js)                          │
├─────────────────────────────────────────────────────────────────┤
│  PUT /cms/layouts/homepage                                      │
│    - Validates layout array                                     │
│    - Logs to console.error (unbuffered)                        │
│    - Logs to layout-changes.log                                │
│    - Calls dataService.updateHomepageLayout(layout)            │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                 DATA SERVICE (data-service.js)                   │
├─────────────────────────────────────────────────────────────────┤
│  updateHomepageLayout(newLayout)                                │
│    - Stringifies layout array to JSON                          │
│    - Updates homepage_layout table                             │
│    - Returns updated layout                                     │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE (SQLite)                             │
├─────────────────────────────────────────────────────────────────┤
│  homepage_layout table:                                         │
│    - id: 'homepage'                                            │
│    - layout: JSON string of widget array                       │
│    - updatedAt: timestamp                                      │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    HOMEPAGE RENDERING                            │
├─────────────────────────────────────────────────────────────────┤
│  • Server reads layout from database                           │
│  • Renders widgets in saved order                              │
│  • Applies saved configurations                                │
└─────────────────────────────────────────────────────────────────┘
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

## Critical Implementation Details

### Property Name Compatibility Issue

> **IMPORTANT**: There is a property name mismatch between default data and saved data that requires backward compatibility handling.

**The Issue:**
- Default homepage layout (in `data-service.js`) uses `config.slug` for category-feed widgets
- CMS JavaScript saves category selections as `config.categorySlug`
- Template and JavaScript must check **both** properties for correct display

**Default Data Format:**
```javascript
// server/services/data-service.js - ensureHomepageLayoutDefaults()
{ type: 'category-feed', config: { category: 'Gündem', slug: 'gundem' } }
```

**Saved Data Format:**
```javascript
// After user saves in CMS
{ type: 'category-feed', config: { categorySlug: 'gundem', categoryName: 'Gündem' } }
```

**Solution:**
```javascript
// Check both properties for backward compatibility
const currentSlug = widget.config.categorySlug || widget.config.slug;
```

This ensures:
- ✅ Fresh installations work (uses `slug` from defaults)
- ✅ After first save, uses `categorySlug`
- ✅ No data migration needed
- ✅ Seamless transition between formats

### Client-Side (`public/cms/js/cms-app.js`)

#### CMSDashboard Class

The main CMS application class that manages all dashboard functionality.

**Key Methods for Layout Management:**
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

### Widget Configuration System

The Sayfa Düzeni tab includes inline configuration controls for each widget type:

#### Configuration Controls by Widget Type

| Widget Type | Config Controls | Data Type | Special Handling |
|-------------|----------------|-----------|------------------|
| `carousel` | autoplay (checkbox)<br>interval (number) | boolean<br>milliseconds | Interval converted from seconds to ms |
| `hero-title` | title (text) | string | Direct string value |
| `featured-news-grid` | limit (number) | integer | Min: 1, Max: 20 |
| `category-feed` | categorySlug (select)<br>limit (number) | string<br>integer | Also stores categoryName for display |
| `flash-news` | limit (number) | integer | Min: 1, Max: 30 |
| `ad-placeholder` | size (select) | string | Options: standard, large, banner |

#### Configuration Update Flow

```javascript
// User changes config input
  ↓
Event listener (change/input)
  ↓
updateWidgetConfig(widgetIndex, configKey, element)
  ↓
Extract value based on element type:
  - checkbox → element.checked
  - number → parseInt(element.value)
  - text/select → element.value
  ↓
Update state.homepageLayout[widgetIndex].config[configKey]
  ↓
Config changes persist in memory until Save button clicked
```

#### State Management

```javascript
// Initial state loaded from server
this.state.homepageLayout = [
  {
    type: 'carousel',
    config: {
      autoplay: true,
      interval: 5000  // milliseconds
    }
  },
  {
    type: 'category-feed',
    config: {
      categorySlug: 'gundem',
      categoryName: 'Gündem',
      limit: 5
    }
  }
  // ... more widgets
];

// Config changes update state immediately
// Order changes update DOM immediately
// Both persist to database only on Save
```

### Category Dropdown System

Category-feed widgets have dynamic dropdowns that automatically update when categories change.

#### updateLayoutCategorySelects() Method

**Purpose**: Refresh all category dropdowns in the layout table with current categories

**Location**: [cms-app.js](file:///home/onuralp/project/UHAWebSitesi/public/cms/js/cms-app.js#L630-L667)

```javascript
updateLayoutCategorySelects() {
  if (!this.layoutTable) return;
  
  const categorySelects = this.layoutTable.querySelectorAll('select[data-config="categorySlug"]');
  
  categorySelects.forEach(select => {
    const widgetIndex = parseInt(select.dataset.widgetIndex);
    
    // CRITICAL: Check both property names for backward compatibility
    const widget = this.state.homepageLayout[widgetIndex];
    const currentValue = widget && widget.config ? 
      (widget.config.categorySlug || widget.config.slug) : '';
    
    // Rebuild options from current categories
    if (this.state.categories.length > 0) {
      select.innerHTML = this.state.categories.map(cat =>
        `<option value="${this.escapeHtml(cat.slug)}"
                ${cat.slug === currentValue ? 'selected' : ''}>
          ${this.escapeHtml(cat.name)}
        </option>`
      ).join('');
      
      // Handle deleted categories
      if (currentValue && !this.state.categories.find(c => c.slug === currentValue)) {
        select.value = this.state.categories[0].slug;
        this.updateWidgetConfig(widgetIndex, 'categorySlug', select);
      }
    } else {
      select.innerHTML = '<option value="">Kategori bulunamadı</option>';
    }
  });
}
```

**Key Features**:
- ✅ Reads category from widget config, not DOM value
- ✅ Checks both `categorySlug` and `slug` properties
- ✅ Rebuilds all options from `state.categories`
- ✅ Preserves current selection when possible
- ✅ Auto-selects first category if current one was deleted
- ✅ Shows "Kategori bulunamadı" when no categories exist

#### Integration Points

**1. On Tab Switch** (showSection method)
```javascript
if (sectionId === 'layout') {
  // Update category dropdowns when showing layout section
  this.updateLayoutCategorySelects();
}
```

**2. On Category Changes** (applyCategories method)
```javascript
applyCategories(categories) {
  const list = Array.isArray(categories) ? categories : [];
  this.state.categories = list;
  this.renderCategories(list);
  this.renderCategoryOptions(list);
  this.updateCategoryStats(list.length);
  this.updateLayoutCategorySelects(); // ← Refresh dropdowns
}
```

#### Category Data Flow

```
User navigates to "Sayfa Düzeni" tab
  ↓
showSection('layout') called
  ↓
updateLayoutCategorySelects() triggered
  ↓
For each category dropdown:
  1. Get widgetIndex from data-widget-index
  2. Read widget = state.homepageLayout[widgetIndex]
  3. Get currentValue = widget.config.categorySlug || widget.config.slug
  4. Build options from state.categories
  5. Mark option as selected if cat.slug === currentValue
  ↓
Dropdowns show correct categories

---

User adds/deletes category in "Kategoriler" tab
  ↓
loadCategories() called
  ↓
applyCategories(newCategories) called
  ↓
state.categories updated
  ↓
updateLayoutCategorySelects() triggered
  ↓
All dropdowns refresh with new category list
  ↓
Deleted categories handled gracefully
```

#### Template (`templates/cms/components/layout-list.njk`)

**Category Dropdown Rendering with Backward Compatibility:**

```html
<table data-cms="layout-table">
  {% for widget in initialState.homepageLayout %}
    <tr data-index="{{ loop.index0 }}">
      {% if widget.type == 'category-feed' %}
        <label class="config-control">
          <span>Kategori:</span>
          <select data-config="categorySlug" 
                  data-widget-index="{{ loop.index0 }}"
                  class="config-select">
            {% if initialState.categories.length > 0 %}
              {% for cat in initialState.categories %}
                {# CRITICAL: Check both property names #}
                {% set currentSlug = widget.config.categorySlug or widget.config.slug %}
                <option value="{{ cat.slug }}" 
                        {% if cat.slug == currentSlug %}selected{% endif %}>
                  {{ cat.name }}
                </option>
              {% endfor %}
            {% else %}
              <option value="">Kategori bulunamadı</option>
            {% endif %}
          </select>
        </label>
      {% endif %}
    </tr>
  {% endfor %}
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

#### Drag Handle Mechanics

```javascript
// Only drag handles are draggable, not entire rows
// This prevents accidental drags when editing configs

handle.addEventListener('mousedown', () => {
  row.setAttribute('draggable', 'true');
});

handle.addEventListener('mouseup', () => {
  setTimeout(() => row.removeAttribute('draggable'), 100);
});
```

#### Custom Drag Image

```javascript
// Creates a smaller, semi-transparent preview
const dragImage = row.cloneNode(true);
dragImage.style.width = (row.offsetWidth * 0.5) + 'px';  // 50% width
dragImage.style.height = '40px';  // Reduced height
dragImage.style.opacity = '0.7';  // Semi-transparent

e.dataTransfer.setDragImage(dragImage, offsetX, offsetY);
```

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

### Data Index Management

```javascript
// Each row has data-index attribute pointing to state array
<tr data-index="0">  <!-- Points to state.homepageLayout[0] -->
<tr data-index="1">  <!-- Points to state.homepageLayout[1] -->

// On save, indices are reassigned to match new DOM order
rows.forEach((row, newIndex) => {
  row.dataset.index = newIndex;
});

// This ensures subsequent saves work correctly
```

### Database Schema

```sql
CREATE TABLE homepage_layout (
  id TEXT PRIMARY KEY,           -- Always 'homepage'
  layout TEXT NOT NULL,          -- JSON stringified array
  updatedAt TEXT                 -- ISO timestamp
);

-- Example stored data:
{
  "id": "homepage",
  "layout": "[{\"type\":\"carousel\",\"config\":{...}},{...}]",
  "updatedAt": "2025-11-25T00:00:00.000Z"
}
```

## Troubleshooting

### Category Dropdown Issues

#### All Dropdowns Show Same Category

**Symptom**: All category-feed widgets show "Ekonomi" (or another single category) instead of their configured categories.

**Root Cause**: Property name mismatch between data format and code expectations.

**Solution**: Ensure both template and JavaScript check for both property names:

```javascript
// JavaScript
const currentValue = widget.config.categorySlug || widget.config.slug;

// Template
{% set currentSlug = widget.config.categorySlug or widget.config.slug %}
```

**Verification**:
1. Open browser console
2. Navigate to Sayfa Düzeni tab
3. Check console logs: `Widget X: configured category = ...`
4. Verify each widget shows different category slug

#### Dropdowns Show "Kategori bulunamadı"

**Symptom**: Category dropdowns are empty or show "Kategori bulunamadı" message.

**Possible Causes**:
1. `updateLayoutCategorySelects()` not called when showing layout tab
2. `state.categories` is empty or undefined
3. Categories not loaded from server

**Solutions**:

**Check 1**: Verify `showSection('layout')` calls `updateLayoutCategorySelects()`
```javascript
if (sectionId === 'layout') {
  this.updateLayoutCategorySelects(); // Must be present
}
```

**Check 2**: Verify categories are loaded in initial state
```javascript
// In browser console
window.__CMS_INITIAL_STATE__.categories
// Should return array of category objects
```

**Check 3**: Verify `applyCategories()` calls `updateLayoutCategorySelects()`
```javascript
applyCategories(categories) {
  // ...
  this.updateLayoutCategorySelects(); // Must be present
}
```

#### Dropdowns Don't Update When Categories Change

**Symptom**: Adding/deleting categories doesn't update the dropdowns in Sayfa Düzeni tab.

**Root Cause**: `updateLayoutCategorySelects()` not called in `applyCategories()`

**Solution**: Ensure the method is called:
```javascript
applyCategories(categories) {
  const list = Array.isArray(categories) ? categories : [];
  this.state.categories = list;
  this.renderCategories(list);
  this.renderCategoryOptions(list);
  this.updateCategoryStats(list.length);
  this.updateLayoutCategorySelects(); // ← Critical
}
```

### General Troubleshooting

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

## Key Features Summary

### 1. Dual Functionality
- **Reordering**: Drag-and-drop to change widget sequence
- **Configuration**: Inline controls to modify widget settings

### 2. Real-Time Updates
- DOM updates immediately on drag
- Config changes update state immediately
- Visual feedback during drag operations

### 3. Persistent Storage
- Changes saved to SQLite database
- JSON format for flexible widget configs
- Timestamp tracking for audit trail

### 4. Developer-Friendly
- Console logging for debugging
- File logging (layout-changes.log)
- Detailed terminal output on save

### 5. Type-Specific Controls
- Each widget type has custom config inputs
- Validation (min/max for numbers)
- Smart defaults and fallbacks

## Implementation Details

### Client-Side Files
- **cms-app.js** (lines 2569-2829): Layout manager implementation
  - `initializeLayoutManager()`: Setup drag-and-drop
  - `initializeConfigControls()`: Setup config event listeners
  - `updateWidgetConfig()`: Handle config changes
  - `handleDragStart/Over/Drop/End()`: Drag mechanics
  - `saveLayout()`: Persist to server

### Server-Side Files
- **cms.js** (lines 727-769): API endpoint
  - Route: `PUT /cms/layouts/homepage`
  - Validation, logging, database update
  
- **data-service.js** (lines 264-332): Data persistence
  - `ensureHomepageLayoutDefaults()`: Initialize defaults
  - `getHomepageLayout()`: Retrieve from database
  - `updateHomepageLayout()`: Save to database

### Template Files
- **layout-list.njk** (lines 1-148): UI component
  - Table structure with drag handles
  - Type-specific config controls
  - Data binding via data-* attributes

## Future Enhancements

- [ ] Add widget enable/disable toggle
- [ ] Support for adding new widgets from CMS
- [ ] Advanced configuration modal for complex widgets
- [ ] Undo/redo functionality
- [ ] Preview mode before saving
- [ ] Multi-page layout support
- [ ] Widget templates/presets
- [ ] Bulk operations (duplicate, delete)

## Related Files

- **Client-Side**: `public/cms/js/cms-app.js` (lines 2569-2915)
- **Template**: `templates/cms/components/layout-list.njk`
- **Server Route**: `server/routes/cms.js` (PUT `/cms/layouts/homepage`)
- **Data Service**: `server/services/data-service.js` (`updateHomepageLayout`, `getHomepageLayout`)
- **Database**: SQLite `homepage_layout` table

## Summary

The Page Order Management System provides a complete solution for managing homepage widget layout through the CMS. The system includes:

### Core Functionality
- ✅ Drag-and-drop widget reordering
- ✅ Inline widget configuration editing
- ✅ Dynamic category dropdown management
- ✅ Real-time state updates
- ✅ Persistent database storage

### Critical Implementation Details

**Property Name Compatibility**:
The most critical aspect of the category dropdown implementation is handling the property name mismatch between default data (`slug`) and saved data (`categorySlug`). Both the template and JavaScript must check for both properties to ensure correct display across fresh installations and after user modifications.

**Data Flow**:
1. Server loads layout from database (may contain either `slug` or `categorySlug`)
2. Template renders with backward compatibility check
3. JavaScript maintains state and handles updates
4. User changes trigger immediate state updates
5. Save button persists to database
6. Category changes automatically refresh all dropdowns

### Key Learnings

1. **Always check widget config, not DOM state** - The DOM value may not reflect the saved configuration
2. **Implement backward compatibility** - Handle both old and new data formats gracefully
3. **Update on tab switch** - Ensure dropdowns populate when user navigates to the tab
4. **Refresh on category changes** - Keep dropdowns in sync with category list
5. **Handle edge cases** - Empty categories, deleted categories, missing config

### Best Practices

- Use `console.log` for debugging state and data flow
- Check both property names when reading category configuration
- Call `updateLayoutCategorySelects()` whenever categories or layout visibility changes
- Preserve user selections when possible, auto-select sensible defaults when not
- Provide clear feedback when categories are unavailable

This documentation should be updated whenever significant changes are made to the layout management system.
