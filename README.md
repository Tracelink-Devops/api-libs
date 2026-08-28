# Tracelink API Client
A Node.js library for interfacing with [Tracelink's REST API](https://tracelink.dk/api-doc/).

To explore and test endpoints interactively in the browser, use the [API Playground](https://tracelink.dk/api-doc/playground.html).                    

## Installation

```bash
npm install tracelink-api
```

## Quick Start

```javascript
const { TracelinkClient } = require('tracelink-api');

// Create a new client
const client = new TracelinkClient({
  access_token: 'your-api-token',
});

// Test the connection
const user = await client.user.get();
console.log('Connected as:', user.user.name);
```

## Configuration

```javascript
const client = new TracelinkClient({
  access_token: 'your-api-token',  // Required
  base_url: 'https://tracelink.app/rest',  // Override for tenant-specific hosts
  format: 'json',                   // 'json' or 'xml' (default: 'json')
  charset: 'UTF-8',                 // 'UTF-8' or 'CP850' (default: 'UTF-8')
});
```

If your company is on its own host, point `base_url` at it — the REST API lives under `/rest`:

```javascript
const client = new TracelinkClient({
  access_token: 'your-api-token',
  base_url: 'https://yourcompany.tracelink.app/rest',
});
```

## API Overview

### Company

```javascript
// Get company master data
const company = await client.company.get();

// List departments
const departments = await client.company.listDepartments();
```

### Users

```javascript
// Get current user
const current_user = await client.user.get();

// List all users
const users = await client.user.list();

// List user groups
const groups = await client.user.listGroups();
```

### Orders

```javascript
// Create a new order
const new_order = await client.order.create({
  number: '2024-001',
  name: 'My new order',
  description: 'Order description',
});
console.log('Created order with ID:', new_order.order_id);

// Create order with auto-numbering
const auto_order = await client.order.createAutoNumbered({
  name: 'Auto-numbered order',
}, 1000, 1);  // Start at 1000, +1 for each

// Get a specific order
const order = await client.order.get(1040);

// List all orders
const orders = await client.order.list();

// Update an order
await client.order.update(1040, {
  name: 'Updated name',
  description: 'New description',
});

// Delete an order
await client.order.delete(1040);
```

### Suborders

```javascript
// Create suborder
const suborder = await client.suborder.create(1040, {
  number: '2024-001-A',
  name: 'Subtask 1',
});

// Get suborder
const sub = await client.suborder.get(suborder.order_sub_id);

// List suborders
const suborders = await client.suborder.list();

// Update suborder
await client.suborder.update(sub.order_sub_id, { name: 'New name' });

// Delete suborder
await client.suborder.delete(sub.order_sub_id);
```

### Modules (Objects)

Tracelink has multiple modules: `purchase`, `genobj`, `customer`, `supplier`, `crm`, `docs`, etc.

```javascript
// Create a purchase
const purchase = await client.object.create('purchase', {
  number: 'PO-001',
  name: 'Material purchase',
  exp_delivery_dt: '2024-12-25 10:00:00',
});

// Get a specific object
const obj = await client.object.get('purchase', 156);

// Get a specific object, expanding sub-tables (see "Expanding sub-tables" below)
const obj_with_lines = await client.object.get('purchase', 156, { expand: 'line' });

// List all objects in a module
const purchases = await client.object.list('purchase');

// Update an object
await client.object.update('purchase', {
  purchase_id: 156,
  name: 'Updated name',
});

// Delete an object
await client.object.delete('purchase', 'purchase_id', 156);
```

### Expanding sub-tables

For modules that have sub-tables (see the **Expand sub-tables** column in [Available Modules](#available-modules)), `client.object.get()` can inline those sub-tables in the response using an OData-inspired `$expand` query parameter, instead of fetching them separately.

Pass a single sub-table name, a comma-separated string, or an array:

```javascript
// Expand a single sub-table
const obj_with_lines = await client.object.get('purchase', 156, { expand: 'line' });

// Expand multiple sub-tables (comma-separated string or array both work)
const obj_with_multiple = await client.object.get('purchase', 156, { expand: 'line,journal' });
const obj_with_multiple_arr = await client.object.get('purchase', 156, { expand: ['line', 'journal'] });
```

Each expanded sub-table is returned as an array under its own key on `object`:

```javascript
{
  "object": {
    "purchase_id": "156",
    // ...other purchase fields...
    "line": [ { /* ... */ }, { /* ... */ } ],
    "journal": [ { /* ... */ } ]
  }
}
```

### QR-code Modules (GenObj, Batch, Stockloc)

For modules with QR-code type, you must first create a tag_id:

```javascript
// Create tag_id
const tag = await client.object.createTag('2', 1);
console.log('Tag ID:', tag.object.tag_id);

// Create object with tag_id
const genobj = await client.object.create('genobj', {
  tag_id: tag.object.tag_id,
  name: 'Stock product',
  description: 'My description',
});
```

### Modules on Orders

```javascript
// Add time registration to an order
const timereg = await client.order.addModule('timereg', {
  order_id: 1040,
  order_sub_id: 0,
  hours: 2,
  minutes: 30,
});

// List time registrations for an order
const timeregs = await client.order.listModule('timereg', 1040);

// List all time registrations
const all_timeregs = await client.order.listModule('timereg');

// Update time registration
await client.order.updateModule('timereg', {
  timereg_id: 1186,
  hours: 3,
});

// Delete time registration
await client.order.deleteModule('timereg', 'timereg_id', 1186);
```

### Module-to-Module Relations

```javascript
// Add genobj to CRM activity
const relation = await client.object.createRelation('genobj', 'crm', {
  genobj_id: 546271,
  crm_id: 16126,
  unit_order_count_f: 1,
});

// List relations
const relations = await client.object.listRelations('genobj', 'crm', 16126);

// Update relation
await client.object.updateRelation('genobj', 'crm', {
  genobj_crm_id: 45150,
  unit_order_count_f: 2,
});

// Delete relation
await client.object.deleteRelation('genobj', 'crm', 'genobj_crm_id', 45150);
```

### Documents

```javascript
const fs = require('fs');

// Upload document to order
const file_data = fs.readFileSync('document.pdf');
await client.order.uploadDocument(1040, {
  data: file_data.toString('base64'),
  filename: 'document.pdf',
  type: 'pdf',
});

// Upload document to module object
await client.object.uploadDocument('purchase', 'purchase_id', 156, {
  data: file_data.toString('base64'),
  filename: 'invoice.pdf',
  type: 'pdf',
});

// List documents for a module
const docs = await client.util.listDocuments('genobj', {
  filter: { update_date: '>2024-01-01' },
});
```

## Sorting, Filtering and Paging

All list methods support sorting, filtering and paging:

```javascript
// Sorting
const orders = await client.order.list({
  sort: 'create_date',      // Single field
  reverse: true,            // Descending order
});

// Multiple sort fields
const orders = await client.order.list({
  sort: ['create_date', 'name'],  // First by create_date, then by name
});

// Filtering
const orders = await client.order.list({
  filter: {
    locked: '=0',                    // Equal to
    create_date: '>2024-01-01',      // Greater than
    name: '%Project%',               // LIKE - bare values are prefix matches, see below
  },
});

// Filter operators
const orders = await client.order.list({
  filter: {
    order_id: 'IN(1,2,3)',          // IN list
    name: '~Test',                   // NOT LIKE
    create_date: 'B2024-01-01,2024-12-31',  // Between
  },
});

// OR filtering
const orders = await client.order.list({
  filter_or: true,
  filter: {
    name: 'Project A',
    description: 'Project B',
  },
});

// Paging
const orders = await client.order.list({
  limit: 100,    // Max 1000
  page: 0,       // First page (0-indexed)
});

// Combined
const orders = await client.order.list({
  sort: 'name',
  limit: 25,
  filter: { locked: '=0' },
});
```

## Filter Operators

| Operator | Description | Example |
|----------|-------------|---------|
| (empty) | LIKE (default) | `name: '%Project%'` |
| `~` | NOT LIKE | `name: '~%Test%'` |
| `=` | Equal to | `locked: '=0'` |
| `!=` | Not equal | `locked: '!=1'` |
| `<` | Less than | `price: '<100'` |
| `<=` | Less than or equal | `price: '<=100'` |
| `>` | Greater than | `create_date: '>2024-01-01'` |
| `>=` | Greater than or equal | `create_date: '>=2024-01-01'` |
| `IN()` | In list | `order_id: 'IN(1,2,3)'` |
| `!IN()` | Not in list | `order_id: '!IN(4,5,6)'` |
| `B` | Between | `date: 'B2024-01-01,2024-12-31'` |

`LIKE`/`NOT LIKE` append a trailing `%` automatically, so a bare value is a **prefix** match, not a
"contains" match:

| Filter | Resulting SQL | Matches |
|--------|---------------|---------|
| `name: 'Steel'` | `LIKE 'Steel%'` | `Steel frame`, but **not** `Cold Steel` |
| `name: '%Steel'` | `LIKE '%Steel%'` | anywhere in the value |
| `name: '%Steel%'` | `LIKE '%Steel%%'` | anywhere in the value (same as above) |

To match anywhere in the value, put a leading `%` on it yourself.

## Response Envelope

Every response is an envelope with `status`, `code`, `message` and `count`. The rows themselves
live under a per-endpoint key, which is not consistent across the API:

| Method | Key holding the rows |
|--------|----------------------|
| `order.list()` | `order` |
| `order.get(id)` | `order` |
| `suborder.list()` | `suborder` |
| `suborder.get(id)` | `suborder` |
| `object.list(module)` | `objects` |
| `object.list('<module>:journal')` | `objects` |
| `object.get(module, id)` | `object` |
| `order.listModule(module)` | `objects` |
| `object.listRelations(a, b)` | `objects` |
| `util.listDocuments(module)` | `object` |
| `user.list()` | `users` |
| `user.get()` | `user` |
| `user.listGroups()` | `group` |
| `company.listDepartments()` | `depts` |
| `company.get()` | `company` |

Note in particular that `object.list()` returns `objects` while `object.get()` returns `object`,
and that `user.list()` returns `users` while `company.listDepartments()` returns `depts` — the
singular/plural choice is not consistent, so check this table rather than guessing.

`company.get()` likewise nests its master data under `company` rather than on the top level, and
returns `company.ui_settings` as a **JSON string** that you have to parse yourself:

```javascript
const response = await client.company.get();
const company = response.company;
const ui_settings = company.ui_settings ? JSON.parse(company.ui_settings) : {};
```

## Idempotency

For safe request retries, you can use idempotency keys:

```javascript
const crypto = require('crypto');

const idempotency_key = crypto.randomUUID().substring(0, 32);

const order = await client.order.create({
  name: 'My order',
}, {
  idempotency_key,
});

// If a network error occurs, you can safely resend the same request
// with the same idempotency_key - the order will only be created once
```

## Error Handling

```javascript
const { TracelinkClient, TracelinkError } = require('tracelink-api');

try {
  const order = await client.order.get(99999);
} catch (error) {
  if (error instanceof TracelinkError) {
    console.error('Tracelink error:', error.message);
    console.error('Error code:', error.code);        // API code, or HTTP status as fallback
    console.error('HTTP status:', error.http_status);
    console.error('Full response:', error.response);
  } else {
    console.error('Network error:', error);
  }
}
```

Any non-2xx response, `status: 'error'` body, or unparseable/empty body is raised as a
`TracelinkError` — the client never lets a raw `SyntaxError` escape.

Several endpoints answer **HTTP 500 with an empty body** when the requested module simply has no
such table (a module without a generic object endpoint, without a journal, or without documents;
likewise a relation pair that is not defined in that direction). Use `error.empty_body` to tell
"not supported for this module" apart from a real failure:

```javascript
try {
  const rows = await client.object.list('trace');
} catch (error) {
  if (error instanceof TracelinkError && error.empty_body) {
    // Module has no generic object endpoint - treat as "no data"
    return [];
  }
  throw error;
}
```

## ESM Import

```javascript
import { TracelinkClient, TracelinkError } from 'tracelink-api';

const client = new TracelinkClient({
  access_token: 'your-api-token',
});
```

## TypeScript

The library includes TypeScript definitions:

```typescript
import { TracelinkClient, TracelinkConfig, OrderParams } from 'tracelink-api';

const config: TracelinkConfig = {
  access_token: 'your-api-token',
};

const client = new TracelinkClient(config);

const options: OrderParams = {
  sort: 'name',
  limit: 25,
  filter: { locked: '=0' },
};

const orders = await client.order.list(options);
```

## Naming Conventions

The library follows JavaScript best practices:
- **Functions**: camelCase (`listDepartments`, `createAutoNumbered`, `uploadDocument`)
- **Variables**: snake_case (`access_token`, `order_id`, `idempotency_key`)

## Available Modules

| Name | Internal Name | Description | Access By | Type | Expand sub-tables |
|------|---------------|-------------|-----------|------|--------------------|
| Custom lists | custlist | Custom lists for extra fields | | | |
| TimeReg | timereg | Time registration | Order | | |
| Customer | customer | Customers | | | |
| Task | task | Tasks and routes | Order | | |
| GenObj | genobj | Generic objects (stock, bookings, etc.) | Direct/Order | QR-code | journal |
| Batch | batch_genobj | Batch portions for stock | GenObj | QR-code | |
| Docs | docs | Guidelines, procedures, documents | | | journal, user |
| CRM | crm | CRM and sales quotes | | | journal, email, econ, genobj |
| QMS | ticket | Deviation/Nonconformance management | | | journal, email, expense (only extra expenses) |
| Purchase | purchase | Purchase orders | | | line, journal, email |
| Supplier | supplier | Purchasing suppliers | | | genobj |
| Stock location | stockloc | Stock locations for GenObj/Batch | | QR-code | |

For modules where **Expand sub-tables** is listed, `client.object.get()` can include those sub-tables inline in the response — see [Expanding sub-tables](#expanding-sub-tables) below.

## Metadata and Foreigndata

All objects have 5 metadata fields (`metadata_1` to `metadata_5`) and 3 foreigndata fields:

```javascript
await client.order.create({
  name: 'My order',
  metadata_1: 'Extra info',
  metadata_2: JSON.stringify(['value1', 'value2']),  // Array format
  foreigndata_1: 'external-id-123',  // ID from external system
});
```

### Metadata

Metadata fields are configurable in the Tracelink system and can be used for any purpose. They can be configured as checkboxes, input fields, dropdowns, etc. The fields can also be extended into "tables" with multiple columns using JSON arrays.

Example for packing dimensions where height=3, width=8, depth=2:
```javascript
metadata_1: JSON.stringify(['3', '8', '2'])
```

### Foreigndata

Foreigndata fields hold external information (e.g., IDs from external systems). These fields are not displayed in the Tracelink system and are only for storing external references.

## Data Types

Column names follow a naming convention where the suffix indicates the type:

| Suffix | Type | Description |
|--------|------|-------------|
| `_cy` | Currency | Decimal |
| `_pct` | Percent | Decimal with % |
| `_sc` | Seconds | Duration in seconds |
| `_i` | Integer | Whole number |
| `_f` | Decimal | Floating point number |
| `_bool` | Boolean | True/false |
| `_byte` | Bytes | Binary data |
| `_dt`, `date_time`, `create_date`, `update_date` | DateTime | Date and time |
| `_da`, `date` | Date | Date only |
| `_ti` | Time | Time of day |

All dates are in CET (adjusted for daylight saving time). All decimals have a maximum length of 16 (10 before decimal point, 6 after).

## Complete Example

```javascript
const { TracelinkClient } = require('tracelink-api');
const crypto = require('crypto');

async function example() {
  // Initialize client
  const client = new TracelinkClient({
    access_token: process.env.TRACELINK_TOKEN,
  });

  try {
    // Create an order with idempotency
    const idempotency_key = crypto.randomUUID().substring(0, 32);
    const order = await client.order.create({
      name: 'Production Order #123',
      description: 'Build 100 units',
      deadline_date: '2024-12-31 16:00:00',
      metadata_1: 'Priority: High',
    }, { idempotency_key });

    console.log('Created order:', order.order_id);

    // Add time registration
    await client.order.addModule('timereg', {
      order_id: order.order_id,
      order_sub_id: 0,
      hours: 5,
      minutes: 30,
    });

    // List orders with filtering
    const active_orders = await client.order.list({
      filter: {
        locked: '=0',
        create_date: '>2024-01-01',
      },
      sort: 'deadline_date',
      limit: 50,
    });

    console.log(`Found ${active_orders.count} active orders`);

  } catch (error) {
    if (error instanceof TracelinkError) {
      console.error('API Error:', error.message);
    } else {
      console.error('Error:', error);
    }
  }
}

example();
```

## License

MIT
