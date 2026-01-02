import psycopg2

def get_connection():
    return psycopg2.connect(
        dbname="postgres",
        user="postgres.bddnadfbblbmkjakxbvd",
        password="hushhours@123",  # Update with your actual password if needed
        host="aws-1-ap-southeast-1.pooler.supabase.com",
        port="5432",
        sslmode="require"
    )
