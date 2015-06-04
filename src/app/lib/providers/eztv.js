(function (App) {
    'use strict';
    var querystring = require('querystring');
    var request = require('request');
    var Q = require('q');
    var inherits = require('util').inherits;

    var URL = false;
    var Eztv = function () {
        Eztv.super_.call(this);
    };

    inherits(Eztv, App.Providers.Generic);

    var queryTorrents = function (filters) {

        var deferred = Q.defer();

        var params = {};
        params.sort = 'seeds';
        params.limit = '50';

        if (filters.keywords) {
            params.keywords = filters.keywords.replace(/\s/g, '% ');
        }

        if (filters.genre) {
            params.genre = filters.genre;
        }

        if (filters.order) {
            params.order = filters.order;
        }

        if (filters.sorter && filters.sorter !== 'popularity') {
            params.sort = filters.sorter;
        }

        var url = AdvSettings.get('tvshowAPI').url + 'shows/' + filters.page + '?' + querystring.stringify(params).replace(/%25%20/g, '%20');
        win.info('Request to EZTV API', url);
        request({
            url: url,
            json: true
        }, function (error, response, data) {
            if (error || response.statusCode >= 400) {
                deferred.reject(error);
            } else if (!data || (data.error && data.error !== 'No movies found')) {
                var err = data ? data.error : 'No data returned';
                win.error('API error:', err);
                deferred.reject(err);
            } else {
                data.forEach(function (entry) {
                    entry.type = 'show';
                });
                deferred.resolve({
                    results: data,
                    hasMore: true
                });
            }
        });

        return deferred.promise;
    };

    // Single element query
    var queryTorrent = function (torrent_id, old_data, debug) {
        debug === undefined ? debug = true : '';
        return Q.Promise(function (resolve, reject) {
            var url = AdvSettings.get('tvshowAPI').url + 'show/' + torrent_id;

            win.info('Request to EZTV API', url);
            request({
                url: url,
                json: true
            }, function (error, response, data) {
                if (error || response.statusCode >= 400) {
                    reject(error);
                } else if (!data || (data.error && data.error !== 'No data returned') || data.episodes.length === 0) {

                    var err = (data && data.episodes.length !== 0) ? data.error : 'No data returned';
                    debug ? win.error('API error:', err) : '';
                    reject(err);

                } else {
                    // we cache our new element or translate synopsis

                    if (Settings.translateSynopsis) {
                        var reqTimeout = setTimeout(function () {
                            resolve(data);
                        }, 2000);
                        App.Trakt.shows.translations(data.imdb_id, Settings.language)
                            .then(function (localization) {
                                if (localization && localization.length !== 0) {
                                    _.extend(data, {
                                        synopsis: localization[0].overview
                                    });
                                    clearTimeout(reqTimeout);
                                    resolve(data);
                                }
                            })
                            .catch(function (error) {
                                resolve(data);
                            });
                    } else {
                        resolve(data);
                    }
                }
            });
        });
    };

    Eztv.prototype.extractIds = function (items) {
        return _.pluck(items.results, 'imdb_id');
    };

    Eztv.prototype.fetch = function (filters) {
        return queryTorrents(filters);
    };

    Eztv.prototype.detail = function (torrent_id, old_data, debug) {
        return queryTorrent(torrent_id, old_data, debug);
    };

    App.Providers.Eztv = Eztv;

})(window.App);
