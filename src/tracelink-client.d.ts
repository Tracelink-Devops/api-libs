/**
 * Tracelink API Client Type Definitions
 */

export interface TracelinkConfig {
  access_token: string;
  /** REST base URL for tenant-specific hosts. Defaults to `https://tracelink.app/rest`. */
  base_url?: string;
  format?: 'json' | 'xml';
  charset?: 'UTF-8' | 'CP850';
}

export interface RequestOptions {
  idempotency_key?: string;
}

export interface GetObjectOptions {
  /** Subtable(s) to include inline in the response, e.g. 'line,journal' or ['line', 'journal'] */
  expand?: string | string[];
}

export interface OrderParams {
  sort?: string | string[];
  reverse?: boolean;
  limit?: number;
  page?: number;
  filter?: Record<string, string | string[]>;
  filter_or?: boolean;
}

export interface TracelinkResponse {
  status: 'ok' | 'error';
  code: number;
  message: string;
  count: number;
  total?: number;
  query_millisec?: number;
  _cached?: boolean;
  _idempotency_key?: string;
}

export interface OrderData {
  number?: string;
  name: string;
  description?: string;
  dept_id?: string;
  start_date?: string;
  deadline_date?: string;
  budget_hours?: string;
  budget_minutes?: string;
  units?: string;
  assigned_user_id?: string;
  customer_id?: string;
  metadata_1?: string;
  metadata_2?: string;
  metadata_3?: string;
  metadata_4?: string;
  metadata_5?: string;
  foreigndata_1?: string;
  foreigndata_2?: string;
  foreigndata_3?: string;
  [key: string]: any;
}

export interface Order extends OrderData {
  order_id: string;
  locked: string;
  paused: string;
  state: string;
  create_date: string;
  update_date: string;
  create_user: string;
  update_user: string;
  create_user_name: string;
  update_user_name: string;
  sub_order: SubOrder[];
}

export interface SubOrderData {
  number?: string;
  name: string;
  description?: string;
  [key: string]: any;
}

export interface SubOrder extends SubOrderData {
  order_sub_id: string;
  /** The parent order. Note it is sent as `parent_id` on create, but returned as `order_id`. */
  order_id: string;
}

export interface DocumentUpload {
  data: string;
  filename: string;
  type?: string;
}

export interface ModuleObject {
  [key: string]: any;
}

export interface Company {
  name: string;
  products?: Array<{ modules: any[] }>;
  depts?: any[];
  /**
   * UI settings, returned as a **JSON string** (not an object).
   * Callers must `JSON.parse()` it themselves.
   */
  ui_settings?: string;
  [key: string]: any;
}

declare class CompanyClient {
  /** Master data is nested under `company` - not spread onto the top level. */
  get(): Promise<TracelinkResponse & { company: Company }>;
  listDepartments(options?: OrderParams): Promise<TracelinkResponse & { depts: any[] }>;
}

declare class UserClient {
  get(): Promise<TracelinkResponse & { user: any }>;
  list(options?: OrderParams): Promise<TracelinkResponse & { users: any[] }>;
  listGroups(options?: OrderParams): Promise<TracelinkResponse & { group: any[] }>;
}

declare class OrderClient {
  create(data: OrderData, options?: RequestOptions): Promise<TracelinkResponse & { order_id: number }>;
  createAutoNumbered(
    data: Omit<OrderData, 'number'>,
    number_begin?: number,
    number_offset?: number,
    options?: RequestOptions
  ): Promise<TracelinkResponse & { order_id: number }>;
  get(order_id: number | string): Promise<TracelinkResponse & { order: Order }>;
  list(options?: OrderParams): Promise<TracelinkResponse & { order: Order[] }>;
  update(order_id: number | string, data: Partial<OrderData>, options?: RequestOptions): Promise<TracelinkResponse>;
  delete(order_id: number | string): Promise<TracelinkResponse>;
  uploadDocument(order_id: number | string, document: DocumentUpload): Promise<TracelinkResponse>;
  addModule(module_name: string, data: ModuleObject, options?: RequestOptions): Promise<TracelinkResponse>;
  listModule(
    module_name: string,
    order_id?: number | string,
    order_sub_id?: number | string,
    options?: OrderParams
  ): Promise<TracelinkResponse & { objects: ModuleObject[] }>;
  updateModule(module_name: string, data: ModuleObject, options?: RequestOptions): Promise<TracelinkResponse>;
  deleteModule(module_name: string, id_field: string, id_value: number | string): Promise<TracelinkResponse>;
}

declare class SuborderClient {
  create(
    parent_order_id: number | string,
    data: SubOrderData,
    options?: RequestOptions
  ): Promise<TracelinkResponse & { order_sub_id: number }>;
  get(order_sub_id: number | string): Promise<TracelinkResponse & { suborder: SubOrder }>;
  list(options?: OrderParams): Promise<TracelinkResponse & { suborder: SubOrder[] }>;
  update(order_sub_id: number | string, data: Partial<SubOrderData>, options?: RequestOptions): Promise<TracelinkResponse>;
  delete(order_sub_id: number | string): Promise<TracelinkResponse>;
}

declare class ObjectClient {
  createTag(product_id: string, count?: number): Promise<TracelinkResponse & { object: { tag_id: string } }>;
  create(module_name: string, data: ModuleObject, options?: RequestOptions): Promise<TracelinkResponse>;
  get(module_name: string, id: number | string, options?: GetObjectOptions): Promise<TracelinkResponse & { object: ModuleObject }>;
  list(module_name: string, options?: OrderParams): Promise<TracelinkResponse & { objects: ModuleObject[] }>;
  /** Preferred form - the object ID is sent in the URL path. */
  update(module_name: string, id: number | string, data: Partial<ModuleObject>, options?: RequestOptions): Promise<TracelinkResponse>;
  /** Legacy form - the object ID must be embedded in `data`. */
  update(module_name: string, data: ModuleObject, options?: RequestOptions): Promise<TracelinkResponse>;
  delete(module_name: string, id_field: string, id_value: number | string): Promise<TracelinkResponse>;
  uploadDocument(
    module_name: string,
    id_field: string,
    id_value: number | string,
    document: DocumentUpload
  ): Promise<TracelinkResponse>;
  createRelation(
    from_module: string,
    to_module: string,
    data: ModuleObject,
    options?: RequestOptions
  ): Promise<TracelinkResponse>;
  listRelations(
    from_module: string,
    to_module: string,
    to_module_id?: number | string,
    options?: OrderParams
  ): Promise<TracelinkResponse & { objects: ModuleObject[] }>;
  updateRelation(
    from_module: string,
    to_module: string,
    data: ModuleObject,
    options?: RequestOptions
  ): Promise<TracelinkResponse>;
  deleteRelation(
    from_module: string,
    to_module: string,
    id_field: string,
    id_value: number | string
  ): Promise<TracelinkResponse>;
}

declare class UtilClient {
  listDocuments(module_name: string, options?: OrderParams): Promise<TracelinkResponse & { object: any[] }>;
}

export declare class TracelinkClient {
  constructor(config: TracelinkConfig);
  
  access_token: string;
  base_url: string;
  format: 'json' | 'xml';
  charset: 'UTF-8' | 'CP850';
  
  company: CompanyClient;
  user: UserClient;
  order: OrderClient;
  suborder: SuborderClient;
  object: ObjectClient;
  util: UtilClient;
  
  request(endpoint: string, body?: object, options?: RequestOptions): Promise<TracelinkResponse>;
}

export declare class TracelinkError extends Error {
  constructor(message: string, code: number);
  /** API error code when present, otherwise the HTTP status. */
  code: number;
  response?: TracelinkResponse;
  /** HTTP status of the response. */
  http_status?: number;
  /**
   * True when the server answered with an empty body - typically a module that
   * has no generic object/journal/document endpoint, rather than a real failure.
   */
  empty_body?: boolean;
  /** Raw response body, set when the body could not be parsed as JSON. */
  raw_body?: string;
}

export declare function buildOrderParams(options?: OrderParams): { order?: object };
