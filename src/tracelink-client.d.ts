/**
 * Tracelink API Client Type Definitions
 */

export interface TracelinkConfig {
  access_token: string;
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
  parent_order_id: string;
}

export interface DocumentUpload {
  data: string;
  filename: string;
  type?: string;
}

export interface ModuleObject {
  [key: string]: any;
}

declare class CompanyClient {
  get(): Promise<TracelinkResponse & { company: any }>;
  listDepartments(options?: OrderParams): Promise<TracelinkResponse & { dept: any[] }>;
}

declare class UserClient {
  get(): Promise<TracelinkResponse & { user: any }>;
  list(options?: OrderParams): Promise<TracelinkResponse & { user: any[] }>;
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
  list(module_name: string, options?: OrderParams): Promise<TracelinkResponse & { object: ModuleObject[] }>;
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
  code: number;
  response?: TracelinkResponse;
}

export declare function buildOrderParams(options?: OrderParams): { order?: object };
