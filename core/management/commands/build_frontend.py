# core/management/commands/build_frontend.py

import subprocess
from django.core.management.base import BaseCommand
import os

class Command(BaseCommand):
    help = 'Build the frontend using Vite'

    def handle(self, *args, **kwargs):
        try:
            frontend_path = os.path.join(os.getcwd(), 'frontend')
            print(frontend_path)
            self.stdout.write(self.style.SUCCESS(f'📦 Building frontend in: {frontend_path}'))

            subprocess.run(['C:\\Program Files\\nodejs\\npm.cmd', 'run', 'build'], cwd=frontend_path, check=True)

            self.stdout.write(self.style.SUCCESS('✅ Frontend built successfully.'))

        except subprocess.CalledProcessError as e:
            self.stderr.write(self.style.ERROR(f'❌ Error during frontend build: {e}'))
        except FileNotFoundError:
            self.stderr.write(self.style.ERROR('❌ npm not found. Make sure it is installed and in your PATH.'))