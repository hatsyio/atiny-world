# Public map exploration (#120)

`/map` is the dedicated geographic reading workspace. The landing continues to use
`PublicMapController` and links to `/map` below its preview, matching the letters
archive action. The global Map navigation link opens `/map` and marks that page
as current; Home stays current throughout the landing.
The dedicated page uses `MapExplorer` with the existing Leaflet map, clustering,
public endpoints and moderation policy.

## Reading state

The URL stores `mapView=latitude,longitude,zoom`, optional `mapCity` and
`mapCountry`, and `letter=publicId` for selection. Changes replace the current
history entry. Opening a detail carries this URL in `returnTo`; explicit return,
browser Back and reload restore the same exploration. A standalone
`/map?letter=publicId` resolves the public point and opens its preview. A saved
`mapView` takes precedence over centering so returning does not reset zoom or pan.
URL writes do not remount the map; external navigation starts a new exploration.

Country labels and order come from stable English and Spanish catalogs. This
avoids differences between server and browser ICU versions during hydration.
City and country use equally sized controls with labels above them, in two columns
on desktop and one column on narrow screens. City typing is applied after 350 ms and matches normalized city fragments
(`Mad` or `MÁ-D` also finds Madrid). City matching ignores case, accents, punctuation and spacing,
and preserves letters from other alphabets. Queries containing only symbols match no cities.
The database uses its standard `und-x-icu` collation for Unicode character classification.
Country changes apply immediately. Country and city combine for both endpoints;
emptying City or choosing All countries removes that criterion and resets the selection
and both result sets. Map filters align with the map edges and have no separate clear button. The fields carry
the current criteria; no duplicate summary is displayed.

Panning and zooming keep the previous markers mounted while the new viewport is
fetched, without displaying a loading overlay. The response replaces the previous
results; changing city or country clears them immediately. Error and retry notices
remain available, and public visibility is still revalidated.

Letter previews always pan into view when opened from a marker or the panel.
Their width and scrollable height follow the actual map size, including fullscreen
changes, so long previews remain inside the map on narrow or short screens.
The landing also retains and revalidates the selected letter outside the cluster,
preventing resize/reclustering from removing its open preview.

## Results and visibility

Requests start after Leaflet reports the visible bounds. `/api/map/features`
returns the bounded marker set; the current zoom enables its truncation notice.
The sidebar uses `/api/map/messages` in pages of 20 with signed cursors. Its counter
reports **loaded letters**, never the marker or cluster count. Cursor boundaries
preserve database timestamp microseconds so traversal cannot skip tied letters. Moving the map or
changing filters changes the query and restarts pagination. During a viewport
refresh with unchanged filters, existing rows stay in place with a loading notice
until fresh results arrive, preserving keyboard focus through canvas resize. On mobile the results
expand below the map; observing canvas resize keeps the visible bounds accurate.

Selecting a panel letter keeps a separately revalidated public marker outside its
cluster. This supports overlapping points and letters omitted by the marker cap.
The popup shows content, author and public location, with a full-detail action.
Panel selection focuses that action when the preview loads, maintaining keyboard
continuity when the mobile panel closes.
Marker selection also updates the reading state. Periodic/focus/reconnect
revalidation and no inactive cache follow the existing public query policy. A
failed public-detail revalidation removes the selected marker; a 404 explains
that it is unavailable, while request failures offer retry.

No publishing rules, providers, schemas or location precision rules change.

## Validation

- `pnpm test`: BDD and all unit tests.
- `pnpm test:map`: real app and local PostgreSQL browser journeys at mobile and
  desktop widths, signed-cursor pagination, overlapping selections, detail return,
  reload/Back, combined filters/pan, visibility, recovery and empty states.
- `pnpm test:visual`: existing component visual regression suite.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`.

The browser suite requires the existing migrated local test database on port
54322 (or a localhost `TEST_DATABASE_URL`). It runs its own development server on
3011, shares the database-suite advisory lock, inserts its own fixtures, and
removes only those fixtures afterward. It does not change `.env` or the development
database. Tile requests are intercepted; all letter endpoints and the detail page
use the real application and test database.

## Automatic filters across the application

The landing map uses the same 350 ms text debounce as `/map`. The letters archive
and administration searches use `AutoFilterForm`: text changes debounce, selects
apply immediately, new criteria reset pagination, and URL updates preserve focus
and scroll. New typing survives older responses; external navigation and Back
restore fields. Public letter filters have no clear button: empty the fields or choose
All countries to remove criteria. Administration Clear cancels pending typing and resets all fields without changing
the form height. Publication and management actions retain explicit confirmation.

Public publication dates are serialized as ISO strings before crossing the server/client
boundary. This keeps archive hydration stable across browser time zones; cursor
timestamps still preserve PostgreSQL microseconds independently.
