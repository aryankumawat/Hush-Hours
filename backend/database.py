import psycopg2

def get_connection():
    return psycopg2.connect(
        dbname="postgres",
        user="postgres",
        password="hushhours@123",
        host="db.bddnadfbblbmkjakxbvd.supabase.co",
        port="5432",
        sslmode="require"
    )
