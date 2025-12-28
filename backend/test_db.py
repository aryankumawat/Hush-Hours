import psycopg2

conn = psycopg2.connect(
    dbname="postgres",
    user="postgres",
    password="hushhours@123",
    host="db.bddnadfbblbmkjakxbvd.supabase.co",
    port="5432",
    sslmode="require"
)

cur = conn.cursor()
cur.execute("SELECT 1;")
print("DB OK:", cur.fetchone())
conn.close()
