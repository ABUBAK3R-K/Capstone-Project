"""Safe rendering of citizen-written report fields inside the dashboard.

Every field of a problem_reports row is written by the mobile client, and
Folium renders popup strings as raw HTML. Anything placed into a popup must
go through here, or a report description becomes script running in the
authority's dashboard session.
"""

from html import escape


def is_http_url(value) -> bool:
    """photo_url is client-supplied; only link it if it's a plain http(s) URL,
    never e.g. a `javascript:` or `data:` URL."""
    return isinstance(value, str) and value.strip().lower().startswith(("https://", "http://"))


def report_popup_html(category, status, description=None, photo_url=None) -> str:
    """The map popup for one report, with every user-controlled value escaped."""
    html = f"<b>{escape(str(category))}</b><br>Status: {escape(str(status))}"
    if description:
        html += f"<br>{escape(str(description))}"
    if is_http_url(photo_url):
        html += (
            f'<br><a href="{escape(photo_url.strip(), quote=True)}" target="_blank" '
            'rel="noopener noreferrer">View Photo</a>'
        )
    return html
