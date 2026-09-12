# Hermes Agent Review #1 — PR #15

**Reviewer:** Hermes Agent
**Date:** 2026-09-12
**Status:** 🔴 CHANGES REQUESTED

---

## 🔴 BUGS

### 1. Dead State Variable Reference in `processText`

**File:** `src/views/CitizenView.tsx:141`

```typescript
setFirstAidProtocol(getFirstAid(sub.condition + ' ' + sub.incident_type));
```

**Issue:** The `getFirstAid` function is called with `sub.condition` which may be an empty string or undefined depending on extraction. If extraction fails to identify a condition, `getFirstAid` receives an empty/undefined string and returns a generic protocol that may not match the actual emergency type.

**Severity:** MEDIUM — Wrong first-aid protocol could be displayed

**Recommendation:** Add validation or fallback:
```typescript
const conditionText = sub.condition || sub.incident_type || 'general emergency';
setFirstAidProtocol(getFirstAid(conditionText));
```

---

### 2. Missing Error Handling for `extractEmergencyInfo` Failure

**File:** `src/views/CitizenView.tsx:129`

```typescript
const extracted = await extractEmergencyInfo(text);
```

**Issue:** If `extractEmergencyInfo` returns `null` or `undefined` (which can happen on API failure), the code will crash at line 130 when trying to access `extracted.incident_type`.

**Severity:** HIGH — Runtime crash on extraction failure

**Recommendation:** Add null check:
```typescript
const extracted = await extractEmergencyInfo(text);
if (!extracted) {
  throw new Error('Failed to extract emergency information');
}
```

---

## 🟡 HIGH PRIORITY

### 3. `handleToggleRecording` Doesn't Block on GPS Failure

**File:** `src/views/CitizenView.tsx:176-181`

```typescript
const handleToggleRecording = useCallback(async () => {
    if (!isRecording) {
      await acquireGPS();
    }
    setIsRecording(prev => !prev);
  }, [isRecording, acquireGPS]);
```

**Issue:** When GPS acquisition fails (`gpsStatus` becomes `'error'`), the recording still starts. This means users can record voice reports without GPS, but the report will fail at submission time with "GPS location required" — a poor UX.

**Severity:** MEDIUM — User records report only to have it rejected at submission

**Recommendation:** Block recording start if GPS fails:
```typescript
const handleToggleRecording = useCallback(async () => {
    if (!isRecording) {
      const coords = await acquireGPS();
      if (!coords) {
        toast.error('GPS required to start recording');
        return;
      }
    }
    setIsRecording(prev => !prev);
  }, [isRecording, acquireGPS]);
```

---

### 4. `processText` Dependency Array Missing `user`

**File:** `src/views/CitizenView.tsx:172`

```typescript
}, [gpsCoords, acquireGPS, createIncident]);
```

**Issue:** `processText` references `user` at line 148 (`user?.name`) but it's not in the dependency array. This means `processText` captures a stale `user` reference.

**Severity:** MEDIUM — Stale user data could appear in reports

**Recommendation:** Add `user` to dependency array:
```typescript
}, [gpsCoords, acquireGPS, createIncident, user]);
```

---

## 🟢 MINOR NOTES

### 5. Map Initial Center Still Hardcoded

**File:** `src/components/LiveMap.tsx:103`

```typescript
center: [124.2452, 8.2280],
```

**Note:** The initial map center is still hardcoded to Iligan City coordinates. While this is a reasonable default for the map view, it's inconsistent with the GPS enforcement policy. If the user is in a different location, the map will center on Iligan City until they interact with it.

**Status:** Acceptable — map defaults are fine, user can pan/zoom

---

### 6. Assessment Rationale Fallback Text

**File:** `src/components/DispatchIncidentDetails.tsx:297`

```typescript
{incident.urgency_reason || triageResult?.urgency_reason || 'Standard report; assessed as non-urgent'}
```

**Note:** The fallback text "Standard report; assessed as non-urgent" assumes non-urgent status when no rationale exists. A more neutral fallback would be "No assessment rationale available" to avoid misleading dispatchers.

**Severity:** LOW — Cosmetic only

---

### 7. `acquireGPS` Callback Stability

**File:** `src/views/CitizenView.tsx:60-82`

The `acquireGPS` callback is memoized with `useCallback(fn, [])` (empty dependency array). This is correct since it only uses `setGpsStatus` and `setGpsCoords` which are stable. However, if `acquireGPS` is called multiple times rapidly (e.g., user taps SOS twice), it could trigger multiple GPS requests simultaneously.

**Status:** Acceptable — geolocation API handles concurrent calls gracefully

---

## 🟢 RECOMMENDATIONS

### 8. Add Loading State for GPS in SOS Button

**File:** `src/views/CitizenView.tsx:346-352`

When the user taps SOS and GPS is loading, there's no visual feedback on the SOS button. Consider showing a loading state:

```typescript
<button
  onClick={handleSOS}
  disabled={gpsStatus === 'loading'}
  className="relative w-36 h-36 rounded-full bg-gradient-to-b from-[#ef4444] to-[#dc2626] text-[#fafafa] text-2xl font-black tracking-widest border-none cursor-pointer flex items-center justify-center shadow-[0_0_40px_rgba(239,68,68,0.3)] z-30 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
>
  {gpsStatus === 'loading' ? '...' : 'SOS'}
</button>
```

---

## Summary

| Category | Count |
|----------|-------|
| 🔴 Bugs | 2 |
| 🟡 High Priority | 2 |
| 🟢 Minor Notes | 3 |
| 🟢 Recommendations | 1 |

**Verdict:** Changes requested. Fix bugs #1 and #2 first, then address high priority items #3 and #4.
