# Synthetic Benchmark Badge Embeds

The GitHub Actions workflow `.github/workflows/synthetic-benchmark.yml` runs the deterministic
synthetic benchmark with no provider credentials and uploads local artifacts only.

Download the `fixel-recall-synthetic-benchmark` workflow artifact, then copy the SVG files into a
committed docs or assets folder if you choose to display them:

```md
![Fixel Recall benchmark](docs/badges/fixel-recall-benchmark.svg)
![Synthetic input reduction](docs/badges/fixel-recall-input-reduction.svg)
![Protected values imaged](docs/badges/fixel-recall-protected-imaged.svg)
![Compatibility status](docs/badges/fixel-recall-compatibility.svg)
```

Every numeric badge based on test data says `SYNTHETIC`. The workflow does not publish to an
external badge service and does not post pull-request comments automatically.
