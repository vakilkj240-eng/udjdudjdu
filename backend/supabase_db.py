import os
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from supabase import create_client, Client

logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

_client: Optional[Client] = None


def get_supabase() -> Client:
    global _client
    if _client is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _client


def _serialize_value(v):
    if isinstance(v, datetime):
        return v.isoformat()
    return v


def _serialize(doc: Dict) -> Dict:
    return {k: _serialize_value(v) for k, v in doc.items()}


def _row_to_doc(row: Dict) -> Optional[Dict]:
    """Flatten a Supabase JSONB row → a flat dict the app can use as a MongoDB document."""
    if row is None:
        return None
    data = row.get("data") or {}
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except Exception:
            data = {}
    doc = dict(data)
    row_id = row.get("id")
    if row_id:
        doc["_id"] = str(row_id)
        doc["id"] = str(row_id)
    return doc


def _apply_jsonb_filter(q, query: Dict):
    """
    Translate Mongo-style query dicts to PostgREST JSONB column filters.
    Our schema stores all document fields inside a JSONB `data` column.
    Direct column queries use `eq(col, val)`.
    JSONB field queries use `filter("data->>'field'", "eq", value)`.
    """
    for key, val in (query or {}).items():
        # ── top-level id / _id ──────────────────────────────────────────
        if key in ("_id", "id"):
            id_val = str(val).strip().replace("ObjectId('", "").replace("')", "")
            q = q.eq("id", id_val)
            continue

        # ── $or ─────────────────────────────────────────────────────────
        if key == "$or":
            for clause in val:
                for k, v in clause.items():
                    if k in ("_id", "id"):
                        q = q.eq("id", str(v))
                    else:
                        q = q.filter(f"data->>'{k}'", "eq", str(v))
            continue

        # ── Mongo operator dict ─────────────────────────────────────────
        if isinstance(val, dict):
            for op, operand in val.items():
                jsonb_path = f"data->>'{key}'"
                if op == "$ne":
                    q = q.filter(jsonb_path, "neq", str(operand))
                elif op == "$gt":
                    q = q.filter(jsonb_path, "gt", str(operand))
                elif op == "$gte":
                    q = q.filter(jsonb_path, "gte", str(operand))
                elif op == "$lt":
                    q = q.filter(jsonb_path, "lt", str(operand))
                elif op == "$lte":
                    q = q.filter(jsonb_path, "lte", str(operand))
                elif op == "$in":
                    q = q.filter(jsonb_path, "in", f"({','.join(str(x) for x in operand)})")
                elif op == "$exists":
                    if operand:
                        q = q.not_.is_(f"data->'{key}'", "null")
                    else:
                        q = q.is_(f"data->'{key}'", "null")
            continue

        # ── plain equality on a JSONB field ─────────────────────────────
        q = q.filter(f"data->>{key}", "eq", str(val))

    return q


class _InsertResult:
    def __init__(self, inserted_id: str):
        self.inserted_id = inserted_id


class _SupabaseCursor:
    """Mimics Motor cursor: .sort(), .skip(), .limit(), .to_list(), async for"""

    def __init__(self, table: str, query: Dict):
        self.table = table
        self.query = query
        self._sort_col: Optional[str] = None
        self._sort_desc: bool = False
        self._skip_n: int = 0
        self._limit_n: int = 1000
        self._results: Optional[List[Dict]] = None
        self._iter_index: int = 0

    def sort(self, field, direction: int = -1):
        if isinstance(field, list):
            if field:
                self._sort_col = field[0][0]
                self._sort_desc = field[0][1] == -1
        else:
            self._sort_col = field
            self._sort_desc = direction == -1
        return self

    def skip(self, n: int):
        self._skip_n = n
        return self

    def limit(self, n: int):
        self._limit_n = n
        return self

    async def _fetch(self, length: int = 1000) -> List[Dict]:
        try:
            sb = get_supabase()
            q = sb.table(self.table).select("*")
            q = _apply_jsonb_filter(q, self.query)
            if self._sort_col:
                col = self._sort_col
                if col == "id":
                    pass  # top-level column
                else:
                    col = f"data->>{col}"
                q = q.order(col, desc=self._sort_desc)
            start = self._skip_n
            end = start + min(self._limit_n, length) - 1
            q = q.range(start, end)
            res = q.execute()
            return [_row_to_doc(r) for r in (res.data or [])]
        except Exception as e:
            msg = str(e)
            if "schema cache" in msg or "Could not find the table" in msg:
                logger.warning(f"Table '{self.table}' does not exist in Supabase — returning empty result")
            else:
                logger.error(f"fetch {self.table}: {e}")
            return []

    async def to_list(self, length: int = 1000) -> List[Dict]:
        return await self._fetch(length)

    def __aiter__(self):
        self._results = None
        self._iter_index = 0
        return self

    async def __anext__(self) -> Dict:
        if self._results is None:
            self._results = await self._fetch()
        if self._iter_index >= len(self._results):
            raise StopAsyncIteration
        item = self._results[self._iter_index]
        self._iter_index += 1
        return item


class _UpdateResult:
    """Mimics Motor UpdateResult with modified_count attribute."""
    def __init__(self, modified_count: int = 0):
        self.modified_count = modified_count
        self.matched_count = modified_count


class _AggregateResult:
    """Stub async-iterable for MongoDB-style aggregate pipelines on Supabase.
    Returns an empty result set — aggregate queries are not supported on Supabase JSONB tables."""

    def __init__(self, table: str, pipeline: List[Dict]):
        self.table = table
        self.pipeline = pipeline
        self._done = False

    def __aiter__(self):
        self._done = False
        return self

    async def __anext__(self) -> Dict:
        raise StopAsyncIteration


class SupabaseCollection:
    """Thin async-compatible wrapper around a single Supabase table."""

    def __init__(self, table: str):
        self.table = table

    def _sb(self):
        return get_supabase()

    async def find_one(self, query: Dict, projection: Optional[Dict] = None) -> Optional[Dict]:
        try:
            sb = self._sb()
            q = sb.table(self.table).select("*")
            q = _apply_jsonb_filter(q, query)
            res = q.limit(1).execute()
            if res.data:
                return _row_to_doc(res.data[0])
            return None
        except Exception as e:
            msg = str(e)
            if "schema cache" in msg or "Could not find the table" in msg:
                logger.warning(f"Table '{self.table}' not in Supabase schema — returning None")
            else:
                logger.error(f"find_one {self.table}: {e}")
            return None

    def find(self, query: Dict = None, projection: Optional[Dict] = None):
        """Synchronous — returns a cursor immediately, just like Motor. Await to_list() on the cursor."""
        return _SupabaseCursor(self.table, query or {})

    async def insert_one(self, doc: Dict) -> "_InsertResult":
        try:
            sb = self._sb()
            data_payload = _serialize(doc)
            # If the doc has an explicit _id/id, use it as the row id
            row_id = data_payload.pop("_id", None) or data_payload.pop("id", None)
            if not row_id:
                row_id = str(uuid.uuid4())
            row = {"id": row_id, "data": data_payload}
            res = sb.table(self.table).insert(row).execute()
            if res.data:
                return _InsertResult(str(res.data[0]["id"]))
            return _InsertResult(row_id)
        except Exception as e:
            logger.error(f"insert_one {self.table}: {e}")
            raise

    async def update_one(self, query: Dict, update: Dict) -> "_UpdateResult":
        try:
            sb = self._sb()
            new_fields = update.get("$set", update)
            new_fields = {k: v for k, v in new_fields.items() if not k.startswith("$")}
            new_fields.pop("_id", None)

            # Fetch current data to merge
            q = sb.table(self.table).select("id,data")
            q = _apply_jsonb_filter(q, query)
            res = q.limit(1).execute()
            if not res.data:
                return _UpdateResult(0)
            row = res.data[0]
            current_data = row.get("data") or {}
            if isinstance(current_data, str):
                try:
                    current_data = json.loads(current_data)
                except Exception:
                    current_data = {}
            # Merge
            current_data.update(_serialize(new_fields))
            sb.table(self.table).update({"data": current_data}).eq("id", str(row["id"])).execute()
            return _UpdateResult(1)
        except Exception as e:
            logger.error(f"update_one {self.table}: {e}")
            raise

    async def update_many(self, query: Dict, update: Dict) -> None:
        try:
            sb = self._sb()
            new_fields = update.get("$set", update)
            new_fields = {k: v for k, v in new_fields.items() if not k.startswith("$")}
            new_fields.pop("_id", None)

            q = sb.table(self.table).select("id,data")
            q = _apply_jsonb_filter(q, query)
            res = q.execute()
            for row in (res.data or []):
                current_data = row.get("data") or {}
                if isinstance(current_data, str):
                    try:
                        current_data = json.loads(current_data)
                    except Exception:
                        current_data = {}
                current_data.update(_serialize(new_fields))
                sb.table(self.table).update({"data": current_data}).eq("id", str(row["id"])).execute()
        except Exception as e:
            logger.error(f"update_many {self.table}: {e}")
            raise

    async def delete_one(self, query: Dict) -> None:
        try:
            sb = self._sb()
            q = sb.table(self.table).delete()
            q = _apply_jsonb_filter(q, query)
            q.execute()
        except Exception as e:
            logger.error(f"delete_one {self.table}: {e}")
            raise

    async def insert_many(self, docs: List[Dict]) -> None:
        try:
            sb = self._sb()
            rows = []
            for doc in docs:
                d = _serialize(doc)
                row_id = d.pop("_id", None) or d.pop("id", None)
                if not row_id:
                    row_id = str(uuid.uuid4())
                rows.append({"id": row_id, "data": d})
            sb.table(self.table).insert(rows).execute()
        except Exception as e:
            logger.error(f"insert_many {self.table}: {e}")
            raise

    async def create_index(self, keys, **kwargs) -> None:
        pass

    async def create_indexes(self, indexes, **kwargs) -> None:
        pass

    def aggregate(self, pipeline: List[Dict]) -> "_AggregateResult":
        return _AggregateResult(self.table, pipeline)

    async def count_documents(self, query: Dict = None) -> int:
        try:
            sb = self._sb()
            q = sb.table(self.table).select("id", count="exact")
            if query:
                q = _apply_jsonb_filter(q, query)
            res = q.execute()
            return res.count or 0
        except Exception as e:
            msg = str(e)
            if "schema cache" in msg or "Could not find the table" in msg:
                logger.warning(f"Table '{self.table}' not in Supabase schema — returning count 0")
            else:
                logger.error(f"count_documents {self.table}: {e}")
            return 0


class SupabaseDB:
    """Drop-in for Motor's database object — access collections as attributes."""

    def __getattr__(self, name: str) -> SupabaseCollection:
        return SupabaseCollection(name)
