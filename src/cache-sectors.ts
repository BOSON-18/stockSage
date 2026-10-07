import { fullSectorScan } from "./data/stock-universe";

//  One time
fullSectorScan().then(() => {
    console.log('Sector cache complete.');
    process.exit(0);
}).catch((error) => {
    console.error('Sector cache failed:', error);
    process.exit(1);
})