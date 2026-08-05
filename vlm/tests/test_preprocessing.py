import tempfile
import unittest
from pathlib import Path

from PIL import Image

from vlm.app.preprocessing import (
    images_in_directory,
    prepare_image,
    resolve_image_paths,
)


class ImageDiscoveryTests(unittest.TestCase):
    def test_images_are_sorted_and_non_images_are_ignored(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            (directory / "b.png").touch()
            (directory / "a.jpg").touch()
            (directory / "notes.txt").touch()

            self.assertEqual(
                [path.name for path in images_in_directory(directory)],
                ["a.jpg", "b.png"],
            )

    def test_directory_argument_is_expanded(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            image = directory / "waste.webp"
            image.touch()

            self.assertEqual(resolve_image_paths([directory]), [image])

    def test_prepare_image_resizes_and_builds_jpeg_data_url(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            source_path = Path(temporary_directory) / "large.png"
            Image.new("RGBA", (2048, 1024), (40, 80, 120, 128)).save(source_path)

            prepared = prepare_image(source_path)

            self.assertEqual((prepared.width, prepared.height), (1024, 512))
            self.assertTrue(prepared.jpeg_bytes.startswith(b"\xff\xd8"))
            self.assertTrue(prepared.data_url.startswith("data:image/jpeg;base64,"))
            self.assertEqual(len(prepared.digest), 64)


if __name__ == "__main__":
    unittest.main()
