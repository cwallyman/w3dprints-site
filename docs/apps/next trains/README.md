# SEPTA Next Trains

Small static web app that shows the next 3 SEPTA Regional Rail trains between:

- Market East (`Jefferson Station (Market East)`)
- Paoli

## Run locally

Start the local server:

```bash
cd /Users/cwallyman/septa-next-trains
python3 server.py
```

Then open `http://localhost:8000`.

## Notes

- The app uses SEPTA's official `Next To Arrive` endpoint.
- A tiny Python proxy avoids browser issues reaching the older SEPTA API directly.
- It requests 3 results and supports swapping the route direction.
- Auto-refresh runs every 30 seconds by default.
