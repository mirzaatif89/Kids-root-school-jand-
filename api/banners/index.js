const { collectionHandler } = require('../_lib/mobileCollectionHandler');

module.exports = collectionHandler({
    storeName: 'banners',
    recordsKey: 'banners',
    itemKey: 'banner',
    prefix: 'BANNER'
});
