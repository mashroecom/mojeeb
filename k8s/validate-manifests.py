#!/usr/bin/env python3
"""
Kubernetes Manifest Validator

This script validates Kubernetes manifests for syntax, structure, and best practices.
Since kubectl is not available in this environment, it performs offline validation.
"""

import sys
import yaml
import os
from pathlib import Path
from typing import Dict, List, Tuple, Any

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

class ManifestValidator:
    def __init__(self, manifest_dir: str):
        self.manifest_dir = Path(manifest_dir)
        self.errors = []
        self.warnings = []
        self.info = []
        self.manifests = []
        self.secrets_refs = set()
        self.configmap_refs = set()
        self.service_refs = set()

    def load_manifests(self) -> bool:
        """Load all YAML manifests from directory"""
        yaml_files = sorted(self.manifest_dir.glob('*.yaml'))

        if not yaml_files:
            self.errors.append(f"No YAML files found in {self.manifest_dir}")
            return False

        self.info.append(f"Found {len(yaml_files)} manifest files")

        for yaml_file in yaml_files:
            try:
                with open(yaml_file, 'r') as f:
                    content = f.read()
                    # Handle multiple documents in one file
                    docs = list(yaml.safe_load_all(content))
                    for doc in docs:
                        if doc:  # Skip empty documents
                            self.manifests.append({
                                'file': yaml_file.name,
                                'content': doc
                            })
                self.info.append(f"✓ Loaded {yaml_file.name}")
            except yaml.YAMLError as e:
                self.errors.append(f"YAML syntax error in {yaml_file.name}: {e}")
                return False
            except Exception as e:
                self.errors.append(f"Error loading {yaml_file.name}: {e}")
                return False

        return True

    def validate_required_fields(self, manifest: Dict, file: str) -> None:
        """Validate required Kubernetes fields"""
        content = manifest['content']

        # Check required top-level fields
        required = ['apiVersion', 'kind', 'metadata']
        for field in required:
            if field not in content:
                self.errors.append(f"{file}: Missing required field '{field}'")

        # Check metadata.name
        if 'metadata' in content:
            if 'name' not in content['metadata']:
                self.errors.append(f"{file}: Missing metadata.name")

            # Check namespace (except for Namespace kind)
            if content.get('kind') != 'Namespace' and 'namespace' not in content['metadata']:
                self.warnings.append(f"{file}: No namespace specified, will use default")

    def validate_deployment(self, manifest: Dict, file: str) -> None:
        """Validate Deployment/StatefulSet specific fields"""
        content = manifest['content']
        kind = content.get('kind')

        if kind not in ['Deployment', 'StatefulSet']:
            return

        spec = content.get('spec', {})
        template = spec.get('template', {})

        # Check replicas
        if 'replicas' not in spec:
            self.warnings.append(f"{file}: No replicas specified, will default to 1")

        # Check pod template
        if not template:
            self.errors.append(f"{file}: Missing pod template")
            return

        containers = template.get('spec', {}).get('containers', [])
        if not containers:
            self.errors.append(f"{file}: No containers defined")
            return

        # Validate each container
        for i, container in enumerate(containers):
            container_name = container.get('name', f'container-{i}')

            # Check image
            if 'image' not in container:
                self.errors.append(f"{file}: Container '{container_name}' missing image")

            # Check resource limits
            if 'resources' not in container:
                self.warnings.append(f"{file}: Container '{container_name}' has no resource limits")
            elif 'limits' not in container.get('resources', {}):
                self.warnings.append(f"{file}: Container '{container_name}' has no resource limits")

            # Check probes
            if 'livenessProbe' not in container:
                self.warnings.append(f"{file}: Container '{container_name}' has no liveness probe")
            if 'readinessProbe' not in container:
                self.warnings.append(f"{file}: Container '{container_name}' has no readiness probe")

    def extract_references(self, manifest: Dict) -> None:
        """Extract ConfigMap, Secret, and Service references"""
        content = manifest['content']
        kind = content.get('kind')
        name = content.get('metadata', {}).get('name', 'unknown')

        # Track created resources
        if kind == 'Secret':
            self.secrets_refs.add(name)
        elif kind == 'ConfigMap':
            self.configmap_refs.add(name)
        elif kind == 'Service':
            self.service_refs.add(name)

        # Extract references from containers
        def extract_env_refs(containers: List) -> None:
            for container in containers:
                for env in container.get('env', []):
                    if 'valueFrom' in env:
                        if 'configMapKeyRef' in env['valueFrom']:
                            ref = env['valueFrom']['configMapKeyRef'].get('name')
                            if ref:
                                self.configmap_refs.add(f"ref:{ref}")
                        if 'secretKeyRef' in env['valueFrom']:
                            ref = env['valueFrom']['secretKeyRef'].get('name')
                            if ref:
                                self.secrets_refs.add(f"ref:{ref}")

        if kind in ['Deployment', 'StatefulSet', 'DaemonSet', 'Job', 'CronJob']:
            spec = content.get('spec', {})
            template = spec.get('template', {})
            containers = template.get('spec', {}).get('containers', [])
            extract_env_refs(containers)
            init_containers = template.get('spec', {}).get('initContainers', [])
            extract_env_refs(init_containers)

    def validate_service_references(self) -> None:
        """Validate that referenced ConfigMaps and Secrets exist"""
        missing_configmaps = [ref for ref in self.configmap_refs if ref.startswith('ref:')
                             and ref[4:] not in [cm for cm in self.configmap_refs if not cm.startswith('ref:')]]
        missing_secrets = [ref for ref in self.secrets_refs if ref.startswith('ref:')
                          and ref[4:] not in [sec for sec in self.secrets_refs if not sec.startswith('ref:')]]

        for ref in missing_configmaps:
            self.warnings.append(f"Referenced ConfigMap '{ref[4:]}' not found in manifests (may need to be created separately)")

        for ref in missing_secrets:
            self.warnings.append(f"Referenced Secret '{ref[4:]}' not found in manifests (must be created before deployment)")

    def validate_hpa(self, manifest: Dict, file: str) -> None:
        """Validate HorizontalPodAutoscaler"""
        content = manifest['content']

        if content.get('kind') != 'HorizontalPodAutoscaler':
            return

        spec = content.get('spec', {})

        if 'scaleTargetRef' not in spec:
            self.errors.append(f"{file}: HPA missing scaleTargetRef")

        if 'minReplicas' in spec and 'maxReplicas' in spec:
            if spec['minReplicas'] > spec['maxReplicas']:
                self.errors.append(f"{file}: minReplicas > maxReplicas")

    def validate_all(self) -> bool:
        """Run all validations"""
        if not self.load_manifests():
            return False

        # Run validations
        for manifest in self.manifests:
            file = manifest['file']
            self.validate_required_fields(manifest, file)
            self.validate_deployment(manifest, file)
            self.extract_references(manifest)
            self.validate_hpa(manifest, file)

        # Validate cross-references
        self.validate_service_references()

        return len(self.errors) == 0

    def print_report(self) -> None:
        """Print validation report"""
        print(f"\n{Colors.BOLD}Kubernetes Manifest Validation Report{Colors.ENDC}")
        print("=" * 60)

        # Info
        if self.info:
            print(f"\n{Colors.BLUE}ℹ INFO:{Colors.ENDC}")
            for msg in self.info:
                print(f"  {msg}")

        # Warnings
        if self.warnings:
            print(f"\n{Colors.YELLOW}⚠ WARNINGS:{Colors.ENDC}")
            for msg in self.warnings:
                print(f"  {msg}")

        # Errors
        if self.errors:
            print(f"\n{Colors.RED}✗ ERRORS:{Colors.ENDC}")
            for msg in self.errors:
                print(f"  {msg}")
        else:
            print(f"\n{Colors.GREEN}✓ No errors found!{Colors.ENDC}")

        # Summary
        print(f"\n{Colors.BOLD}Summary:{Colors.ENDC}")
        print(f"  Manifests: {len(self.manifests)}")
        print(f"  Errors: {len(self.errors)}")
        print(f"  Warnings: {len(self.warnings)}")

        if len(self.errors) == 0:
            print(f"\n{Colors.GREEN}{Colors.BOLD}✓ Validation PASSED{Colors.ENDC}")
        else:
            print(f"\n{Colors.RED}{Colors.BOLD}✗ Validation FAILED{Colors.ENDC}")

def main():
    manifest_dir = os.path.join(os.path.dirname(__file__))

    print(f"Validating manifests in: {manifest_dir}")

    validator = ManifestValidator(manifest_dir)
    success = validator.validate_all()
    validator.print_report()

    sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()
