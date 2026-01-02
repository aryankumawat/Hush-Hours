import psycopg2
from psycopg2 import pool
import time
import threading

# Connection pool configuration
_pool = None
_pool_lock = threading.Lock()

def init_connection_pool():
    """Initialize the connection pool"""
    global _pool
    if _pool is None:
        with _pool_lock:
            if _pool is None:
                try:
                    _pool = psycopg2.pool.ThreadedConnectionPool(
                        minconn=1,
                        maxconn=20,  # Maximum 20 connections in pool
                        dbname="postgres",
                        user="postgres.bddnadfbblbmkjakxbvd",
                        password="hushhours@123",
                        host="aws-1-ap-southeast-1.pooler.supabase.com",
                        port="5432",
                        sslmode="require",
                        connect_timeout=10  # 10 second timeout
                    )
                    print("[DEBUG database] Connection pool initialized successfully")
                except Exception as e:
                    print(f"[ERROR database] Failed to initialize connection pool: {e}")
                    _pool = None
    return _pool

def get_connection():
    """Get a connection from the pool with retry logic"""
    pool = init_connection_pool()
    
    if pool is None:
        # Fallback to direct connection if pool fails
        print("[WARNING database] Using direct connection (pool unavailable)")
        return psycopg2.connect(
            dbname="postgres",
            user="postgres.bddnadfbblbmkjakxbvd",
            password="hushhours@123",
            host="aws-1-ap-southeast-1.pooler.supabase.com",
            port="5432",
            sslmode="require",
            connect_timeout=10
        )
    
    # Retry logic for getting connection from pool
    max_retries = 3
    for attempt in range(max_retries):
        try:
            conn = pool.getconn()
            if conn:
                # Test the connection
                cur = conn.cursor()
                cur.execute("SELECT 1")
                cur.close()
                return conn
        except Exception as e:
            print(f"[WARNING database] Failed to get connection from pool (attempt {attempt + 1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                time.sleep(0.1 * (attempt + 1))  # Exponential backoff
            else:
                # Last attempt failed, try direct connection
                print("[WARNING database] Pool exhausted, using direct connection")
                try:
                    return psycopg2.connect(
                        dbname="postgres",
                        user="postgres.bddnadfbblbmkjakxbvd",
                        password="hushhours@123",
                        host="aws-1-ap-southeast-1.pooler.supabase.com",
                        port="5432",
                        sslmode="require",
                        connect_timeout=10
                    )
                except Exception as direct_error:
                    print(f"[ERROR database] Direct connection also failed: {direct_error}")
                    raise
    
    raise Exception("Failed to get database connection after retries")

def return_connection(conn):
    """Return a connection to the pool"""
    global _pool
    if not conn:
        return
    
    if _pool:
        try:
            _pool.putconn(conn)
        except Exception as e:
            # Connection might not be from pool, or pool error occurred
            print(f"[WARNING database] Error returning connection to pool: {e}")
            try:
                conn.close()
            except:
                pass
    else:
        # No pool, just close the connection
        try:
            conn.close()
        except:
            pass

def close_all_connections():
    """Close all connections in the pool (for cleanup)"""
    global _pool
    if _pool:
        try:
            _pool.closeall()
            print("[DEBUG database] All pool connections closed")
        except Exception as e:
            print(f"[WARNING database] Error closing pool: {e}")
        finally:
            _pool = None

class DatabaseConnection:
    """Context manager for database connections"""
    def __init__(self):
        self.conn = None
        self.cur = None
    
    def __enter__(self):
        self.conn = get_connection()
        self.cur = self.conn.cursor()
        return self.cur, self.conn
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.cur:
            try:
                self.cur.close()
            except:
                pass
        if self.conn:
            try:
                if exc_type:
                    self.conn.rollback()
                else:
                    self.conn.commit()
            except:
                pass
            return_connection(self.conn)
        return False  # Don't suppress exceptions
