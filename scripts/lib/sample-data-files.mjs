// The canonical mapping from committed sample fixtures to the data-repo files
// they seed. Shared by scripts/init-sample-repo.mjs (first-time repo setup)
// and scripts/reset-demo-repo.mjs (nightly demo reset) so the two stay in sync.
export const SAMPLE_DATA_FILES = [
  { src: "data/jobs.sample.json", dest: "data/jobs.json" },
  { src: "data/config.sample.json", dest: "data/config.json" },
  { src: "data/profile.sample.json", dest: "data/profile.json" },
  { src: "data/scrape-targets.sample.json", dest: "data/scrape-targets.json" },
];
