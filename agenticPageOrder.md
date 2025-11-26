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
- **Add New Widgets**: Add widgets dynamically via the "Bileşen Ekle" modal
- **Turkish Localization**: All widget names are displayed in Turkish

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
│  • Applies saved configurations (limit, category, etc.)        │
│  • Fetches data based on config                                │
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

  addWidget(type) {
    // Create new widget with default config
    const newWidget = { type, config: { ...defaultConfig } };
    
    // Update state
    this.state.homepageLayout.push(newWidget);
    
    // Render new row client-side
    const newRow = this.renderLayoutRow(newWidget, index);
    tbody.appendChild(newRow);
  }
}
```

### Widget Addition System

The "Bileşen Ekle" modal allows users to add new widgets to the layout.

**Key Components:**
1.  **`availableWidgets`**: Array of widget definitions with Turkish titles and default configurations.
2.  **`renderLayoutRow(widget, index)`**: Client-side method that duplicates the Nunjucks template logic to render a new table row dynamically.
3.  **`addWidget(type)`**: Handles the state update, DOM manipulation, and UI feedback (toast, scroll).

**Turkish Localization:**
Widget names are standardized to Turkish in both:
-   **Server-side**: `layout-list.njk` using a mapping object.
-   **Client-side**: `cms-app.js` using `availableWidgets` titles.

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

### Frontend Integration (Homepage)

The frontend correctly interprets the saved configurations to render widgets dynamically.

#### Category Feed Integration (`server/routes/pages.js`)

The route handler supports both old and new data formats for category widgets:

```javascript
// Support both new (categoryName) and old (category) config properties
const categoryName = widget.config.categoryName || widget.config.category;

if (categoryName) {
  // Fetch articles for specific category
  const categoryArticles = dataService.getArticles({
    category: categoryName,
    // ...
  });
}
```

#### Featured News Grid Integration

The `featured-news-grid` widget respects the configured news count limit:

```javascript
if (widget.config.source === 'featured') {
  // Use configured limit or defaults (8 for carousel, 6 for grid)
  const defaultLimit = widget.type === 'carousel' ? 8 : 6;
  const limit = parseInt(widget.config.limit) || defaultLimit;
  
  const featuredArticles = dataService.getArticles({
    limit: limit,
    // ...
  });
}
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

## Technical Deep Dive

### How Drag-and-Drop Reordering Works

The Sayfa Düzeni system implements a sophisticated drag-and-drop mechanism that separates visual ordering from state management. Understanding this separation is crucial for implementing similar systems.

#### 1. Drag Handle System

**Purpose**: Only allow dragging when user explicitly grabs the handle, preventing accidental drags during config editing.

**Implementation Pattern**:
```javascript
// Drag handles are made draggable on mousedown, removed on mouseup
const dragHandles = table.querySelectorAll('.layout-drag-handle');
dragHandles.forEach(handle => {
  const row = handle.closest('tr');
  handle.addEventListener('mousedown', () => {
    row.setAttribute('draggable', 'true');
  });
  handle.addEventListener('mouseup', () => {
    setTimeout(() => row.removeAttribute('draggable'), 100);
  });
});
```

**Why This Matters**: Without this pattern, any click on a table row would initiate drag, making it impossible to interact with config controls.

#### 2. Drag Event Sequence

The HTML5 drag-and-drop API follows a strict event sequence:

1. **`dragstart`** (fired once when dragging begins)
   - Store reference to dragged row: `this.draggedRow = row`
   - Create custom drag image (smaller, semi-transparent preview)
   - Set `effectAllowed = 'move'` to indicate move operation
   - Add visual feedback class to dragged row

2. **`dragover`** (fired continuously while hovering over valid drop targets)
   - **CRITICAL**: Must call `e.preventDefault()` to allow drop
   - Calculate drop position (above/below target row)
   - Show visual indicators (border highlights, insertion markers)
   - Store reference to current drop target

3. **`drop`** (fired once when drop occurs)
   - **CRITICAL**: Must call `e.preventDefault()` and `e.stopPropagation()`
   - Perform DOM reordering using `before()` or `after()` methods
   - Update visual order numbers
   - Clear all visual indicators

4. **`dragend`** (fired once when drag operation completes)
   - Cleanup: remove visual classes, reset dragged row reference
   - Remove draggable attribute from row

**Key Insight**: The `dragover` event fires continuously (many times per second) while hovering, so keep calculations lightweight. Only perform DOM manipulations in `drop`.

#### 3. Drop Position Calculation

The system determines whether to insert above or below the target row based on cursor position:

```javascript
const bounding = targetRow.getBoundingClientRect();
const midpoint = bounding.y + (bounding.height / 2);
const isAfter = e.clientY > midpoint;  // Cursor below midpoint?

if (isAfter) {
  targetRow.after(draggedRow);  // Insert after
} else {
  targetRow.before(draggedRow);  // Insert before
}
```

**Why This Matters**: This provides intuitive insertion at the exact cursor position, not just at row boundaries.

#### 4. DOM-State Synchronization Pattern

**The Core Problem**: DOM order and state array order can diverge during drag operations.

**The Solution**: Use `data-index` attributes as a bridge between DOM and state:

```javascript
// Initial state: [widget0, widget1, widget2]
// DOM rows: <tr data-index="0">, <tr data-index="1">, <tr data-index="2">

// After drag: widget1 moved to position 0
// DOM rows reordered: widget1 row is now first
// BUT data-index still points to state.homepageLayout[1]

// On save, rebuild order using data-index:
const newOrder = Array.from(rows).map(row => {
  const index = parseInt(row.dataset.index);  // Still points to [1]
  return this.state.homepageLayout[index];    // Gets widget1
});
// newOrder = [widget1, widget0, widget2] ✅

// Then update state and reassign indices:
this.state.homepageLayout = newOrder;
rows.forEach((row, newIndex) => {
  row.dataset.index = newIndex;  // Now data-index matches array index
});
```

**Critical Understanding**: 
- `data-index` is a **pointer** to the state array, not the DOM position
- During drag, only DOM order changes; `data-index` stays constant
- On save, use `data-index` to rebuild state array from current DOM order
- After save, reassign `data-index` to match new state array order

#### 5. Visual Order vs. Data Index

The system maintains two separate concepts:

1. **Visual Order Number** (displayed in `.layout-order` cell): Shows 1, 2, 3... based on DOM position
2. **Data Index** (`data-index` attribute): Points to state array index, may not match visual order

**Update Pattern**:
```javascript
updateLayoutOrder() {
  const rows = table.querySelectorAll('tbody tr');
  rows.forEach((row, visualIndex) => {
    const orderCell = row.querySelector('.layout-order');
    orderCell.textContent = visualIndex + 1;  // Visual: 1, 2, 3...
    // Note: data-index is NOT updated here
  });
}
```

**When Visual Order Updates**:
- Immediately after drag-and-drop (in `handleDrop`)
- When widget is added
- When widget is removed

**When Data Index Updates**:
- On save (in `saveLayout`) - reassigned to match new state order
- When widget is removed - all subsequent indices decremented

#### 6. State Array Reordering

The state array must be reordered to match the DOM order when saving:

```javascript
async saveLayout() {
  // Step 1: Collect widgets in DOM order, using data-index as lookup
  const rows = this.layoutTable.querySelectorAll('tbody tr');
  const newOrder = Array.from(rows).map(row => {
    const oldIndex = parseInt(row.dataset.index);  // Old state array index
    return this.state.homepageLayout[oldIndex];    // Get widget from state
  });
  
  // Step 2: Update state array with new order
  this.state.homepageLayout = newOrder;
  
  // Step 3: Reassign data-index to match new state order
  rows.forEach((row, newIndex) => {
    row.dataset.index = newIndex;  // Now matches state array index
  });
  
  // Step 4: Persist to server
  await fetch('/cms/layouts/homepage', {
    method: 'PUT',
    body: JSON.stringify({ layout: newOrder })
  });
}
```

**Why This Two-Step Process**: 
- First, use old indices to correctly map widgets from state
- Then, reassign indices so subsequent operations work correctly

### How Configuration Updates Work

Configuration changes update state immediately but don't persist until save:

#### Config Control Event Flow

```javascript
// Event delegation on table
table.addEventListener('change', (e) => {
  const configKey = e.target.dataset.config;      // e.g., 'limit'
  const widgetIndex = parseInt(e.target.dataset.widgetIndex);  // e.g., 2
  updateWidgetConfig(widgetIndex, configKey, e.target);
});

updateWidgetConfig(widgetIndex, configKey, element) {
  let value;
  
  // Extract value based on element type
  if (element.type === 'checkbox') {
    value = element.checked;  // boolean
  } else if (element.type === 'number') {
    value = parseInt(element.value);  // number
  } else {
    value = element.value;  // string
  }
  
  // Update state immediately
  this.state.homepageLayout[widgetIndex].config[configKey] = value;
}
```

**Key Points**:
- Uses event delegation (listener on table, not each input)
- Extracts values based on input type
- Updates state immediately (optimistic update)
- No server communication until save button clicked

#### Special Value Transformations

Some config values require transformation:

```javascript
// Interval: user inputs seconds, stored as milliseconds
if (configKey === 'interval') {
  value = parseInt(element.value) * 1000;
}

// Category: also store display name
if (configKey === 'categorySlug') {
  const selectedOption = element.options[element.selectedIndex];
  widget.config.categoryName = selectedOption.text;
}
```

### How Save Flow Works

The save operation is a carefully orchestrated sequence:

```javascript
async saveLayout() {
  // PHASE 1: Collection
  // - Read current DOM order
  // - Map each row to its widget using data-index
  const rows = this.layoutTable.querySelectorAll('tbody tr');
  const newOrder = Array.from(rows).map(row => {
    const index = parseInt(row.dataset.index);
    return this.state.homepageLayout[index];
  });
  
  // PHASE 2: Index Reassignment
  // - Update data-index attributes to match new order
  // - This ensures subsequent saves work correctly
  rows.forEach((row, newIndex) => {
    row.dataset.index = newIndex;
    
    // Also update all config control indices
    row.querySelectorAll('[data-widget-index]').forEach(el => {
      el.dataset.widgetIndex = newIndex;
    });
  });
  
  // PHASE 3: State Update
  // - Replace state array with new order
  this.state.homepageLayout = newOrder;
  
  // PHASE 4: Persistence
  // - Send to server
  // - Server validates, logs, persists to database
  const response = await fetch('/cms/layouts/homepage', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ layout: newOrder })
  });
  
  // PHASE 5: Feedback
  if (response.ok) {
    this.showToast('Sayfa düzeni başarıyla kaydedildi', 'success');
  }
}
```

**Why This Order Matters**:
1. Must collect widgets BEFORE updating indices (otherwise wrong widgets collected)
2. Must update indices AFTER collection but BEFORE state update
3. Must update state to ensure UI reflects saved state
4. Server persistence is final step

## Implementation Framework

This framework provides reusable patterns for implementing similar drag-and-drop widget ordering systems in other contexts.

### Core Component Structure

Every widget ordering system needs these core components:

```javascript
class WidgetOrderManager {
  constructor(tableSelector, stateKey, apiEndpoint) {
    // 1. DOM References
    this.table = document.querySelector(tableSelector);
    this.saveBtn = document.querySelector('[data-action="save-' + stateKey + '"]');
    this.addBtn = document.querySelector('[data-action="add-' + stateKey + '-widget"]');
    
    // 2. State Management
    this.state = { [stateKey]: [] };  // e.g., { homepageLayout: [...] }
    this.stateKey = stateKey;
    
    // 3. Drag State
    this.draggedRow = null;
    this.currentDropTarget = null;
    
    // 4. API Configuration
    this.apiEndpoint = apiEndpoint;  // e.g., '/cms/layouts/homepage'
    
    // 5. Widget Definitions
    this.availableWidgets = [];  // Define widget types and defaults
  }
  
  // Required Methods (see Method Templates below)
  initialize() { }
  handleDragStart(e) { }
  handleDragOver(e) { }
  handleDrop(e) { }
  handleDragEnd(e) { }
  updateOrder() { }
  save() { }
}
```

### Method Templates

#### 1. Initialization Method

```javascript
initialize() {
  if (!this.table) return;
  
  // A. Setup drag handles
  const dragHandles = this.table.querySelectorAll('.layout-drag-handle');
  dragHandles.forEach(handle => {
    const row = handle.closest('tr');
    if (row) {
      handle.addEventListener('mousedown', () => {
        row.setAttribute('draggable', 'true');
      });
      handle.addEventListener('mouseup', () => {
        setTimeout(() => row.removeAttribute('draggable'), 100);
      });
    }
  });
  
  // B. Setup drag events
  this.table.addEventListener('dragstart', this.handleDragStart.bind(this));
  this.table.addEventListener('dragover', this.handleDragOver.bind(this));
  this.table.addEventListener('drop', this.handleDrop.bind(this));
  this.table.addEventListener('dragend', this.handleDragEnd.bind(this));
  
  // C. Setup save button
  if (this.saveBtn) {
    this.saveBtn.addEventListener('click', () => this.save());
  }
  
  // D. Setup config controls (if needed)
  this.initializeConfigControls();
}
```

#### 2. Drag Start Handler

```javascript
handleDragStart(e) {
  const row = e.target.closest('tr');
  if (!row) return;
  
  this.draggedRow = row;
  this.table.classList.add('dragging-active');
  e.dataTransfer.effectAllowed = 'move';
  
  // Create custom drag image
  const dragImage = row.cloneNode(true);
  dragImage.style.position = 'absolute';
  dragImage.style.top = '-9999px';
  dragImage.style.width = (row.offsetWidth * 0.5) + 'px';
  dragImage.style.height = '40px';
  dragImage.style.opacity = '0.7';
  document.body.appendChild(dragImage);
  e.dataTransfer.setDragImage(dragImage, row.offsetWidth * 0.25, 20);
  setTimeout(() => document.body.removeChild(dragImage), 0);
  
  // Visual feedback
  setTimeout(() => row.classList.add('cms-dragging'), 0);
}
```

#### 3. Drag Over Handler

```javascript
handleDragOver(e) {
  e.preventDefault();  // CRITICAL: Allows drop
  e.dataTransfer.dropEffect = 'move';
  
  const row = e.target.closest('tr');
  if (!row || row === this.draggedRow || !this.draggedRow) return;
  
  // Clear previous indicators
  this.clearDropIndicators();
  
  // Calculate drop position
  const bounding = row.getBoundingClientRect();
  const midpoint = bounding.y + (bounding.height / 2);
  const isAfter = e.clientY > midpoint;
  
  // Show visual indicator
  row.classList.add(isAfter ? 'drop-below' : 'drop-above');
  this.currentDropTarget = row;
}
```

#### 4. Drop Handler

```javascript
handleDrop(e) {
  e.stopPropagation();
  e.preventDefault();
  
  if (!this.draggedRow || !this.currentDropTarget) return;
  
  // Calculate final drop position
  const bounding = this.currentDropTarget.getBoundingClientRect();
  const midpoint = bounding.y + (bounding.height / 2);
  const isAfter = e.clientY > midpoint;
  
  // Reorder DOM
  if (isAfter) {
    this.currentDropTarget.after(this.draggedRow);
  } else {
    this.currentDropTarget.before(this.draggedRow);
  }
  
  // Update visual order
  this.updateOrder();
  this.clearDropIndicators();
  
  return false;
}
```

#### 5. Order Update Method

```javascript
updateOrder() {
  const rows = this.table.querySelectorAll('tbody tr');
  rows.forEach((row, index) => {
    const orderCell = row.querySelector('.layout-order');
    if (orderCell) {
      orderCell.textContent = index + 1;  // Visual order only
    }
  });
}
```

#### 6. Save Method

```javascript
async save() {
  try {
    // Step 1: Collect widgets in DOM order
    const rows = this.table.querySelectorAll('tbody tr');
    const newOrder = Array.from(rows).map(row => {
      const index = parseInt(row.dataset.index);
      return this.state[this.stateKey][index];
    });
    
    // Step 2: Reassign indices
    rows.forEach((row, newIndex) => {
      row.dataset.index = newIndex;
      // Update config control indices if present
      row.querySelectorAll('[data-widget-index]').forEach(el => {
        el.dataset.widgetIndex = newIndex;
      });
    });
    
    // Step 3: Update state
    this.state[this.stateKey] = newOrder;
    
    // Step 4: Persist to server
    const response = await fetch(this.apiEndpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layout: newOrder })
    });
    
    if (!response.ok) throw new Error('Save failed');
    
    this.showToast('Layout saved successfully', 'success');
  } catch (error) {
    console.error('Save error:', error);
    this.showToast('Failed to save layout', 'error');
  }
}
```

### State Management Rules

1. **State Structure**: Always use array of widget objects with `type` and `config` properties
2. **Config Updates**: Update state immediately on config change
3. **Order Updates**: Update DOM immediately on drag, update state only on save
4. **Index Consistency**: Always maintain `data-index` attributes matching state array indices after save
5. **Widget Addition**: Add to state array first, then render to DOM
6. **Widget Removal**: Remove from state array, then remove from DOM, then re-index

### Template Structure Pattern

```html
<table data-cms="[table-name]-table">
  <thead>
    <tr>
      <th width="40"></th>  <!-- Drag handle column -->
      <th width="50">Sıra</th>  <!-- Order number column -->
      <th>Bileşen Tipi</th>
      <th>Yapılandırma</th>
      <th>Durum</th>
    </tr>
  </thead>
  <tbody>
    {% for widget in initialState.[stateKey] %}
    <tr data-index="{{ loop.index0 }}">
      <td class="layout-drag-handle" title="Sürükle">
        <span class="drag-icon">⋮⋮</span>
      </td>
      <td class="layout-order">{{ loop.index }}</td>
      <td>
        <span class="cms-badge">{{ widget.type }}</span>
      </td>
      <td>
        <!-- Widget-specific config controls -->
      </td>
      <td>
        <!-- Status and actions -->
      </td>
    </tr>
    {% endfor %}
  </tbody>
</table>
```

## Step-by-Step Implementation Guide

Use this guide when implementing a new drag-and-drop widget ordering system.

### Phase 1: Setup

1. **Define Widget Types**
   - Create array of available widget definitions
   - Each widget needs: `type`, `title`, `desc`, `defaultConfig`

2. **Create Template**
   - Use table structure with drag handles
   - Include `data-index` on each row
   - Add config controls for each widget type

3. **Initialize State**
   - Load layout from server or use defaults
   - Store in component state: `this.state.layoutName = [...]`

4. **Get DOM References**
   - Table element: `document.querySelector('[data-cms="table-name"]')`
   - Save button: `document.querySelector('[data-action="save-layout"]')`
   - Add button (if applicable)

### Phase 2: Drag Setup

1. **Implement Drag Handles**
   - Add mousedown/mouseup listeners to drag handle elements
   - Set `draggable="true"` on mousedown, remove on mouseup

2. **Implement Drag Events**
   - `dragstart`: Store dragged row, create drag image, add visual feedback
   - `dragover`: Prevent default, calculate drop position, show indicators
   - `drop`: Reorder DOM, update visual order, clear indicators
   - `dragend`: Cleanup visual feedback, reset dragged row

3. **Test Drag Functionality**
   - Verify rows can be dragged
   - Verify visual indicators appear
   - Verify DOM reorders correctly

### Phase 3: Order Management

1. **Implement `updateOrder()` Method**
   - Updates visual order numbers (`.layout-order` cells)
   - Called after every drag operation

2. **Implement Index Management**
   - Ensure `data-index` attributes are set correctly
   - Update indices when widgets added/removed

3. **Test Order Updates**
   - Verify order numbers update after drag
   - Verify order persists across multiple drags

### Phase 4: Save Functionality

1. **Implement `save()` Method**
   - Collect widgets in DOM order using `data-index`
   - Reassign indices to match new order
   - Update state array
   - Send to server

2. **Create Server Endpoint**
   - Validate layout array
   - Persist to database
   - Return updated layout

3. **Test Save Flow**
   - Verify widgets collected correctly
   - Verify state updates correctly
   - Verify server receives correct order
   - Verify database stores correctly

### Phase 5: Config Controls (Optional)

1. **Implement Config Event Listeners**
   - Use event delegation on table
   - Handle `change` and `input` events

2. **Implement Config Update Method**
   - Extract value based on input type
   - Update state immediately
   - Handle special transformations

3. **Test Config Updates**
   - Verify values update in state
   - Verify values persist through drag operations
   - Verify values save correctly

### Phase 6: Widget Management (Optional)

1. **Implement Add Widget**
   - Create modal with widget list
   - Add widget to state
   - Render to DOM
   - Update order numbers

2. **Implement Remove Widget**
   - Remove from state
   - Remove from DOM
   - Re-index remaining widgets

3. **Test Widget Management**
   - Verify widgets can be added
   - Verify widgets can be removed
   - Verify indices remain correct

## Code Patterns Library

### Pattern 1: Drop Position Calculation

```javascript
function calculateDropPosition(targetRow, mouseY) {
  const bounding = targetRow.getBoundingClientRect();
  const midpoint = bounding.y + (bounding.height / 2);
  return mouseY > midpoint ? 'after' : 'before';
}
```

### Pattern 2: DOM Reordering

```javascript
function reorderDOM(draggedRow, targetRow, position) {
  if (position === 'after') {
    targetRow.after(draggedRow);
  } else {
    targetRow.before(draggedRow);
  }
}
```

### Pattern 3: Collect Widgets from DOM Order

```javascript
function collectWidgetsInDOMOrder(table, stateArray) {
  const rows = table.querySelectorAll('tbody tr');
  return Array.from(rows).map(row => {
    const index = parseInt(row.dataset.index);
    return stateArray[index];
  });
}
```

### Pattern 4: Reassign Data Indices

```javascript
function reassignIndices(table, includeConfigControls = true) {
  const rows = table.querySelectorAll('tbody tr');
  rows.forEach((row, newIndex) => {
    row.dataset.index = newIndex;
    
    if (includeConfigControls) {
      row.querySelectorAll('[data-widget-index]').forEach(el => {
        el.dataset.widgetIndex = newIndex;
      });
    }
  });
}
```

### Pattern 5: Visual Order Update

```javascript
function updateVisualOrder(table) {
  const rows = table.querySelectorAll('tbody tr');
  rows.forEach((row, index) => {
    const orderCell = row.querySelector('.layout-order');
    if (orderCell) {
      orderCell.textContent = index + 1;
    }
  });
}
```

### Pattern 6: Custom Drag Image Creation

```javascript
function createDragImage(row) {
  const dragImage = row.cloneNode(true);
  dragImage.style.position = 'absolute';
  dragImage.style.top = '-9999px';
  dragImage.style.width = (row.offsetWidth * 0.5) + 'px';
  dragImage.style.height = '40px';
  dragImage.style.opacity = '0.7';
  dragImage.style.backgroundColor = '#e3f2fd';
  dragImage.style.border = '2px solid #007bff';
  dragImage.style.borderRadius = '4px';
  dragImage.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
  dragImage.style.overflow = 'hidden';
  dragImage.style.display = 'table';
  dragImage.style.tableLayout = 'fixed';
  dragImage.style.fontSize = '12px';
  dragImage.style.whiteSpace = 'nowrap';
  
  document.body.appendChild(dragImage);
  return dragImage;
}
```

### Pattern 7: Config Value Extraction

```javascript
function extractConfigValue(element) {
  switch (element.type) {
    case 'checkbox':
      return element.checked;
    case 'number':
      return parseInt(element.value) || 0;
    case 'select-one':
      return element.value;
    default:
      return element.value;
  }
}
```

### Pattern 8: State Update on Config Change

```javascript
function updateWidgetConfig(state, widgetIndex, configKey, element, transformations = {}) {
  let value = extractConfigValue(element);
  
  // Apply transformations if needed
  if (transformations[configKey]) {
    value = transformations[configKey](value, element);
  }
  
  // Ensure config object exists
  if (!state[widgetIndex].config) {
    state[widgetIndex].config = {};
  }
  
  // Update config
  state[widgetIndex].config[configKey] = value;
  
  // Handle special cases (e.g., category name)
  if (configKey === 'categorySlug' && element.options) {
    const option = element.options[element.selectedIndex];
    state[widgetIndex].config.categoryName = option.text;
  }
  
  return value;
}
```

## Comparison: Sayfa Düzeni vs Makale Düzeni

This comparison helps understand what works well and what needs enhancement when implementing similar systems.

### Feature Parity Comparison

| Feature | Sayfa Düzeni | Makale Düzeni | Status |
|---------|--------------|---------------|--------|
| Drag-and-Drop Reordering | ✅ Full implementation | ✅ Full implementation | ✅ Complete |
| Visual Order Updates | ✅ Updates after drag | ✅ Updates after drag | ✅ Complete |
| State Synchronization | ✅ Updates on save | ⚠️ Missing - state not updated after drag | ⚠️ Needs Enhancement |
| Data-Index Management | ✅ Updates on save | ✅ Updates on save | ✅ Complete |
| Config Controls | ✅ Full implementation | ✅ Full implementation | ✅ Complete |
| Widget Addition | ✅ Modal + dynamic render | ✅ Modal + dynamic render | ✅ Complete |
| Widget Removal | ✅ With re-indexing | ✅ With re-indexing | ✅ Complete |
| Save Functionality | ✅ Complete flow | ✅ Complete flow | ✅ Complete |

### Key Difference: State Update After Drag

**Sayfa Düzeni** (Homepage Layout):
- Visual order updates immediately after drag ✅
- State array updates only on save ✅
- This is correct behavior - state stays in sync with saved data

**Makale Düzeni** (Article Layout):
- Visual order updates immediately after drag ✅
- State array updates on save ✅
- **Issue**: If multiple drag operations occur before save, the intermediate state may not reflect DOM order

**Recommendation**: Both systems are correct, but for better consistency, consider updating state immediately after drag (as shown in the enhanced implementation pattern).

### Implementation Quality Comparison

#### Drag-and-Drop Mechanics

Both systems implement identical drag-and-drop mechanics:
- ✅ Same drag handle system
- ✅ Same event handlers
- ✅ Same visual feedback
- ✅ Same drop position calculation

#### State Management

**Sayfa Düzeni**:
```javascript
// State updated on save only
async saveLayout() {
  const newOrder = collectFromDOM();
  this.state.homepageLayout = newOrder;  // Updated here
  await persistToServer(newOrder);
}
```

**Makale Düzeni**:
```javascript
// Same pattern - state updated on save only
async saveArticleLayout() {
  const newOrder = collectFromDOM();
  this.state.articleLayout = newOrder;  // Updated here
  await persistToServer(newOrder);
}
```

**Verdict**: Both follow the same pattern. This is acceptable but could be enhanced to update state immediately after drag for better consistency.

#### Config Control Updates

Both systems handle config updates identically:
- ✅ Event delegation on table
- ✅ Immediate state updates
- ✅ Value extraction based on input type

### Lessons Learned

1. **State Update Timing**: Updating state immediately after drag provides better consistency, but updating only on save is simpler and still correct.

2. **Index Management**: The `data-index` pattern works well for both systems. It provides a reliable bridge between DOM and state.

3. **Code Reusability**: Both systems share ~90% of implementation code. The framework above would eliminate this duplication.

4. **Visual Feedback**: Both systems provide excellent visual feedback during drag operations. The custom drag image pattern is effective.

### Enhancement Opportunities for Makale Düzeni

1. **Immediate State Update After Drag**: Update `this.state.articleLayout` immediately after `handleArticleDrop()` to keep state in sync with DOM.

2. **Config Control Index Updates**: Ensure all `data-widget-index` attributes are updated when rows are reordered, not just on save.

3. **Console Logging**: Add debug logging similar to Sayfa Düzeni for easier troubleshooting.

### Best Practices Derived

1. **Always update visual order immediately** - Provides instant user feedback
2. **Update state on save** - Ensures single source of truth is the saved data
3. **Use data-index as bridge** - Reliable pattern for DOM-state synchronization
4. **Reassign indices after save** - Critical for subsequent operations
5. **Update config control indices** - Necessary when rows are reordered

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
- [ ] Add widget enable/disable toggle
- [x] Support for adding new widgets from CMS
- [ ] Advanced configuration modal for complex widgets
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
7. Frontend reads saved config (checking both property names)
8. Homepage renders with correct categories and limits

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
