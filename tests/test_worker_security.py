import importlib.util
from pathlib import Path
import socket
import unittest
import urllib.request
from unittest.mock import patch, Mock

spec = importlib.util.spec_from_file_location('media_worker', Path(__file__).resolve().parents[1] / 'processor' / 'worker.py')
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)
PUBLIC = [(socket.AF_INET, socket.SOCK_STREAM, 6, '', ('8.8.8.8', 443))]

class WorkerSecurityTests(unittest.TestCase):
    def test_https_public_url(self):
        with patch.object(worker.socket, 'getaddrinfo', return_value=PUBLIC):
            worker.validate_destination('https://example.com/file.mp4')

    def test_rejects_http_and_nonstandard_port(self):
        for url in ('http://example.com/file.mp4', 'https://example.com:8443/file.mp4'):
            with self.assertRaises(ValueError):
                worker.validate_destination(url)

    def test_rejects_private_dns(self):
        with patch.object(worker.socket, 'getaddrinfo', return_value=[(socket.AF_INET, socket.SOCK_STREAM, 6, '', ('127.0.0.1', 443))]):
            with self.assertRaises(ValueError):
                worker.validate_destination('https://example.com/file.mp4')

    def test_redirect_open_rejects_downgrade_before_transport(self):
        with patch.object(worker, '_original_open') as transport:
            with self.assertRaises(ValueError):
                worker.guarded_open(Mock(), urllib.request.Request('http://example.com/file.mp4'))
            transport.assert_not_called()

    def test_socket_guard_blocks_private_and_plaintext(self):
        sock = Mock(family=socket.AF_INET, type=socket.SOCK_STREAM)
        for address in (('127.0.0.1', 443), ('8.8.8.8', 80)):
            with self.assertRaises(OSError):
                worker.public_sockaddr(sock, address)
        self.assertEqual(worker.public_sockaddr(sock, ('8.8.8.8', 443)), ('8.8.8.8', 443))

if __name__ == '__main__':
    unittest.main()
