from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.urls import reverse

from bibliodata.models import Author, Publication


class ExportReportFormatsTest(TestCase):
    """Smoke tests for export_report endpoint ensuring new formats respond successfully.

    These tests create a minimal dataset and authenticate a user, then call the
    export endpoint with different format parameters. They validate HTTP 200 and
    basic content-type correctness for each implemented format (excluding PDF charts).
    """

    def setUp(self):
        """Create a minimal dataset and authenticate a user."""
        user_model = get_user_model()
        self.user = user_model.objects.create_user(username='tester', password='pass1234')
        self.client = Client()
        self.client.login(username='tester', password='pass1234')

        # Minimal publication + author
        self.author = Author.objects.create(gesbib_id='A1', name='Alice Example')
        self.pub = Publication.objects.create(
            gb_id='P1', title='Example Publication', year=2024, citations=5
        )
        self.pub.authors.add(self.author)

        self.url = reverse('export_report')  # core/urls.py name


    def _assert_ok(self, fmt, expected_ct_part):
        resp = self.client.post(self.url, {'format': fmt})
        self.assertEqual(resp.status_code, 200, f"Format {fmt} did not return 200")
        self.assertIn(expected_ct_part, resp['Content-Type'], f"Unexpected content type for {fmt}")

    def test_csv(self):
        self._assert_ok('csv', 'text/csv')

    def test_ndjson(self):
        self._assert_ok('ndjson', 'application/x-ndjson')

    def test_bibtex(self):
        self._assert_ok('bibtex', 'application/x-bibtex')

    def test_ris(self):
        self._assert_ok('ris', 'application/x-research-info-systems')

    def test_gexf(self):
        self._assert_ok('gexf', 'application/gexf+xml')

    def test_network_csv(self):
        self._assert_ok('network_csv', 'text/csv')

    def test_zip(self):
        self._assert_ok('zip', 'application/zip')

    def test_pdf(self):
        # PDF requires fallback; just ensure 200 and pdf mime
        resp = self.client.post(self.url, {'format': 'pdf'})
        self.assertEqual(resp.status_code, 200)
        self.assertIn('application/pdf', resp['Content-Type'])

    def test_pdf_with_collaboration_maps(self):
        """PDF export should accept optional collaboration map images.

        We only validate the request succeeds. Rendering correctness is covered
        by manual UI testing because the images are captured client-side.
        """
        # 1x1 transparent PNG
        tiny_png = (
            'data:image/png;base64,'
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6X9qWcAAAAASUVORK5CYII='
        )
        resp = self.client.post(
            self.url,
            {
                'format': 'pdf',
                'lang': 'en',
                'collab_map_world_img': tiny_png,
                'collab_map_spain_img': tiny_png,
            },
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn('application/pdf', resp['Content-Type'])
