# DHA Sanitizer Pattern Analysis

## Issue: Missed Pattern

**Pattern that was missed:**
```
Canan İLARSLAN - Feridun AÇIKGÖZ/ İSTANBUL, DHA/ BAĞCILAR
```

## Why the Current Regex Failed

### Current Regex (line 64 of `workers/dha-sanitize.js`):
```javascript
/^\s*(?:Haber\s*[-–—]\s*Kamera:\s*)?[\p{L}.'’\-–—\s]{2,120}\s*\/\s*[\p{L}0-9()'’.,\-–—\s]{2,160}\s*,?\s*\(DHA\)\s*[-–—]?\s*/u
```

### Problems Identified:

1. **Missing `(DHA)` parentheses**: The regex expects `(DHA)` but the pattern has `DHA/` (no parentheses)
2. **Missing `DHA/` variant**: The regex doesn't account for `DHA/` followed by another location
3. **Multi-author with dash**: The pattern has two authors separated by ` - ` which may not be fully captured
4. **Additional location after DHA**: The pattern has `DHA/ BAĞCILAR` which the regex doesn't handle

## Pattern Variations Found in DHA RSS

Based on analysis of `tests/dha_rss.xml` and code review:

### Currently Handled Patterns:
- ✅ `Yavuz YILMAZ/ İNEGÖL(Bursa), (DHA)- ...`
- ✅ `Serhan TÜRK / MONACO, (DHA)- ...`
- ✅ `Olgucan KALKAN – Ali DANAŞ / İSTANBUL,(DHA)- ...`
- ✅ `Haber-Kamera: Emre ÖNCEL- Berkay YILDIZ/ SAMSUN, (DHA)-`

### Missing Patterns:
- ❌ `Canan İLARSLAN - Feridun AÇIKGÖZ/ İSTANBUL, DHA/ BAĞCILAR` (no parentheses, DHA/ format)
- ❌ `NAME - NAME/ LOCATION, DHA/ LOCATION` (DHA followed by slash and another location)
- ❌ `NAME/ LOCATION, DHA/ LOCATION` (simpler variant)

## Recommended Fix

### Option 1: Extend Current Regex
Add support for `DHA/` (without parentheses) and optional second location:

```javascript
const bylinePrefixRegex =
  /^\s*(?:Haber\s*[-–—]\s*Kamera:\s*)?[\p{L}.'’\-–—\s]{2,120}\s*\/\s*[\p{L}0-9()'’.,\-–—\s]{2,160}\s*,?\s*(?:\(DHA\)|DHA\/)\s*[-–—]?\s*(?:[A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ\s]*)?\s*/u;
```

### Option 2: Multiple Regex Patterns
Use separate patterns for different variants:

```javascript
// Pattern 1: Standard (DHA) format
const standardByline = /^\s*(?:Haber\s*[-–—]\s*Kamera:\s*)?[\p{L}.'’\-–—\s]{2,120}\s*\/\s*[\p{L}0-9()'’.,\-–—\s]{2,160}\s*,?\s*\(DHA\)\s*[-–—]?\s*/u;

// Pattern 2: DHA/ format (no parentheses)
const dhaSlashByline = /^\s*[\p{L}.'’\-–—\s]{2,120}\s*\/\s*[\p{L}0-9()'’.,\-–—\s]{2,160}\s*,?\s*DHA\/\s*[A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ\s]*\s*/u;
```

## Database Scan Results

- **Total RSS articles scanned**: 200 most recent
- **Articles with byline patterns found**: 0
- **Note**: This suggests either:
  1. The sanitizer already cleaned most patterns
  2. The `DHA/` variant is rare
  3. Articles with this pattern haven't been imported yet

## Test Cases to Add

```javascript
// Test case 1: DHA/ without parentheses
'Canan İLARSLAN - Feridun AÇIKGÖZ/ İSTANBUL, DHA/ BAĞCILAR'

// Test case 2: DHA/ with single author
'Canan İLARSLAN/ İSTANBUL, DHA/ BAĞCILAR'

// Test case 3: DHA/ without second location
'Canan İLARSLAN/ İSTANBUL, DHA/'

// Test case 4: DHA/ with different spacing
'Canan İLARSLAN/ İSTANBUL, DHA / BAĞCILAR'
```

## Next Steps

1. Update regex to handle `DHA/` format (with and without second location)
2. Add test cases for the missed pattern
3. Re-scan database after fix to identify articles that need cleanup
4. Consider creating a cleanup script for existing articles with missed patterns

