'use strict';

//  ---------------------------------------------------------------------------

const Exchange = require ('./base/Exchange');

//  ---------------------------------------------------------------------------

module.exports = class bitpanda extends Exchange {
    describe () {
        return this.deepExtend (super.describe (), {
            'id': 'bitpanda',
            'name': 'Bitpanda',
            'countries': [ 'AT' ], // Austria
            'rateLimit': 300,
            'version': 'v1',
            // new metainfo interface
            'has': {
                'fetchCurrencies': true,
                'fetchMarkets': true,
                'fetchOrderBook': true,
                'fetchTime': true,
                'fetchTradingFees': true,
                'fetchTicker': true,
                'fetchTickers': true,
            },
            'timeframes': {
                '1m': '1m',
                '3m': '3m',
                '5m': '5m',
                '15m': '15m',
                '30m': '30m',
                '1h': '1h',
                '2h': '2h',
                '4h': '4h',
                '6h': '6h',
                '8h': '8h',
                '12h': '12h',
                '1d': '1d',
                '3d': '3d',
                '1w': '1w',
                '1M': '1M',
            },
            'urls': {
                'logo': 'https://user-images.githubusercontent.com/1294454/29604020-d5483cdc-87ee-11e7-94c7-d1a8d9169293.jpg',
                'api': {
                    'public': 'https://api.exchange.bitpanda.com/public',
                    'private': 'https://api.exchange.bitpanda.com/public',
                },
                'www': 'https://www.bitpanda.com',
                'doc': [
                    'https://developers.bitpanda.com',
                ],
                'fees': 'https://www.bitpanda.com/en/pro/fees',
            },
            'api': {
                'public': {
                    'get': [
                        'currencies',
                        'candlesticks/{instrument_code}',
                        'fees',
                        'instruments',
                        'order-book/{instrument_code}',
                        'market-ticker',
                        'market-ticker/{instrument_code}',
                        'price-ticks/{instrument_code}',
                        'time',
                    ],
                },
                'private': {
                    'get': [
                        'account/balances',
                        'account/deposit/crypto/{currency_code}',
                        'account/deposit/fiat/EUR',
                        'account/deposits',
                        'account/deposits/bitpanda',
                        'account/withdrawals',
                        'account/withdrawals/bitpanda',
                        'account/fees',
                        'account/orders',
                        'account/orders/{order_id}',
                        'account/orders/{order_id}/trades',
                        'account/trades',
                        'account/trades/{trade_id}',
                        'account/trading-volume',
                    ],
                    'post': [
                        'account/deposit/crypto',
                        'account/withdraw/crypto',
                        'account/withdraw/fiat',
                        'account/fees',
                        'account/orders',
                    ],
                    'delete': [
                        'account/orders',
                        'account/orders/{order_id}',
                        'account/orders/client/{client_id}',
                    ],
                },
            },
            'fees': {
                'trading': {
                    'tierBased': false,
                    'percentage': true,
                    'taker': 0.15 / 100,
                    'maker': 0.10 / 100,
                    'tiers': [
                        // volume in BTC
                        {
                            'taker': [
                                [0, 0.15 / 100],
                                [100, 0.13 / 100],
                                [250, 0.13 / 100],
                                [1000, 0.1 / 100],
                                [5000, 0.09 / 100],
                                [10000, 0.075 / 100],
                                [20000, 0.065 / 100],
                            ],
                            'maker': [
                                [0, 0.1 / 100],
                                [100, 0.1 / 100],
                                [250, 0.09 / 100],
                                [1000, 0.075 / 100],
                                [5000, 0.06 / 100],
                                [10000, 0.05 / 100],
                                [20000, 0.05 / 100],
                            ],
                        },
                    ],
                },
            },
            // exchange-specific options
            'options': {
            },
            'exceptions': {
            },
        });
    }

    async fetchTime (params = {}) {
        const response = await this.publicGetTime (params);
        //
        //     {
        //         iso: '2020-07-10T05:17:26.716Z',
        //         epoch_millis: 1594358246716,
        //     }
        //
        return this.safeInteger (response, 'epoch_millis');
    }

    async fetchCurrencies (params = {}) {
        const response = await this.publicGetCurrencies (params);
        //
        //     [
        //         {
        //             "code":"BEST",
        //             "precision":8
        //         }
        //     ]
        //
        const result = {};
        for (let i = 0; i < response.length; i++) {
            const currency = response[i];
            const id = this.safeString (currency, 'code');
            const code = this.safeCurrencyCode (id);
            result[code] = {
                'id': id,
                'code': code,
                'name': undefined,
                'info': currency, // the original payload
                'active': undefined,
                'fee': undefined,
                'precision': this.safeInteger (currency, 'precision'),
                'limits': {
                    'amount': { 'min': undefined, 'max': undefined },
                    'price': { 'min': undefined, 'max': undefined },
                    'cost': { 'min': undefined, 'max': undefined },
                    'withdraw': { 'min': undefined, 'max': undefined },
                },
            };
        }
        return result;
    }

    async fetchMarkets (params = {}) {
        const response = await this.publicGetInstruments (params);
        //
        //     [
        //         {
        //             state: 'ACTIVE',
        //             base: { code: 'ETH', precision: 8 },
        //             quote: { code: 'CHF', precision: 2 },
        //             amount_precision: 4,
        //             market_precision: 2,
        //             min_size: '10.0'
        //         }
        //     ]
        //
        const result = [];
        for (let i = 0; i < response.length; i++) {
            const market = response[i];
            const baseAsset = this.safeValue (market, 'base', {});
            const quoteAsset = this.safeValue (market, 'quote', {});
            const baseId = this.safeString (baseAsset, 'code');
            const quoteId = this.safeString (quoteAsset, 'code');
            const id = baseId + '_' + quoteId;
            const base = this.safeCurrencyCode (baseId);
            const quote = this.safeCurrencyCode (quoteId);
            const symbol = base + '/' + quote;
            const precision = {
                'amount': this.safeInteger (market, 'amount_precision'),
                'price': this.safeInteger (market, 'market_precision'),
            };
            const limits = {
                'amount': {
                    'min': undefined,
                    'max': undefined,
                },
                'price': {
                    'min': undefined,
                    'max': undefined,
                },
                'cost': {
                    'min': this.safeFloat (market, 'min_size'),
                    'max': undefined,
                },
            };
            const state = this.safeString (market, 'state');
            const active = (state === 'ACTIVE');
            result.push ({
                'id': id,
                'symbol': symbol,
                'base': base,
                'quote': quote,
                'baseId': baseId,
                'quoteId': quoteId,
                'precision': precision,
                'limits': limits,
                'info': market,
                'active': active,
            });
        }
        return result;
    }

    async fetchTradingFees (params = {}) {
        await this.loadMarkets ();
        const response = await this.publicGetFees (params);
        //
        //     [
        //         {
        //             "fee_group_id":"default",
        //             "display_text":"The standard fee plan.",
        //             "fee_tiers":[
        //                 {"volume":"0.0","fee_group_id":"default","maker_fee":"0.1","taker_fee":"0.15"},
        //                 {"volume":"100.0","fee_group_id":"default","maker_fee":"0.1","taker_fee":"0.13"},
        //                 {"volume":"250.0","fee_group_id":"default","maker_fee":"0.09","taker_fee":"0.13"},
        //                 {"volume":"1000.0","fee_group_id":"default","maker_fee":"0.075","taker_fee":"0.1"},
        //                 {"volume":"5000.0","fee_group_id":"default","maker_fee":"0.06","taker_fee":"0.09"},
        //                 {"volume":"10000.0","fee_group_id":"default","maker_fee":"0.05","taker_fee":"0.075"},
        //                 {"volume":"20000.0","fee_group_id":"default","maker_fee":"0.05","taker_fee":"0.065"}
        //             ],
        //             "fee_discount_rate":"25.0",
        //             "minimum_price_value":"0.12"
        //         }
        //     ]
        //
        const feeGroupsById = this.indexBy (response, 'fee_group_id');
        const feeGroupId = this.safeValue (this.options, 'fee_group_id', 'default');
        const feeGroup = this.safeValue (feeGroupsById, feeGroupId, {});
        const feeTiers = this.safeValue (feeGroup, 'fee_tiers');
        const result = {};
        for (let i = 0; i < this.symbols.length; i++) {
            const symbol = this.symbols[i];
            const fee = {
                'info': feeGroup,
                'symbol': symbol,
                'maker': undefined,
                'taker': undefined,
                'percentage': true,
                'tierBased': true,
            };
            const takerFees = [];
            const makerFees = [];
            for (let i = 0; i < feeTiers.length; i++) {
                const tier = feeTiers[i];
                const volume = this.safeFloat (tier, 'volume');
                let taker = this.safeFloat (tier, 'taker_fee');
                let maker = this.safeFloat (tier, 'maker_fee');
                taker /= 100;
                maker /= 100;
                takerFees.push ([ volume, taker ]);
                makerFees.push ([ volume, maker ]);
                if (i === 0) {
                    fee['taker'] = taker;
                    fee['maker'] = maker;
                }
            }
            const tiers = {
                'taker': takerFees,
                'maker': makerFees,
            };
            fee['tiers'] = tiers;
            result[symbol] = fee;
        }
        return result;
    }

    parseTicker (ticker, market = undefined) {
        //
        // fetchTicker, fetchTickers
        //
        //     {
        //         "instrument_code":"BTC_EUR",
        //         "sequence":602562,
        //         "time":"2020-07-10T06:27:34.951Z",
        //         "state":"ACTIVE",
        //         "is_frozen":0,
        //         "quote_volume":"1695555.1783768",
        //         "base_volume":"205.67436",
        //         "last_price":"8143.91",
        //         "best_bid":"8143.71",
        //         "best_ask":"8156.9",
        //         "price_change":"-147.47",
        //         "price_change_percentage":"-1.78",
        //         "high":"8337.45",
        //         "low":"8110.0"
        //     }
        //
        const timestamp = this.parse8601 (this.safeString (ticker, 'time'));
        const marketId = this.safeString (ticker, 'instrument_code');
        let symbol = undefined;
        if (marketId !== undefined) {
            if (marketId in this.markets_by_id) {
                market = this.markets_by_id[marketId];
            } else if (marketId !== undefined) {
                const [ baseId, quoteId ] = marketId.split ('_');
                const base = this.safeCurrencyCode (baseId);
                const quote = this.safeCurrencyCode (quoteId);
                symbol = base + '/' + quote;
            }
        }
        if ((symbol === undefined) && (market !== undefined)) {
            symbol = market['symbol'];
        }
        const last = this.safeFloat (ticker, 'last_price');
        const percentage = this.safeFloat (ticker, 'price_change_percentage');
        const change = this.safeFloat (ticker, 'price_change');
        let open = undefined;
        let average = undefined;
        if ((last !== undefined) && (change !== undefined)) {
            open = last - change;
            average = this.sum (last, open) / 2;
        }
        const baseVolume = this.safeFloat (ticker, 'base_volume');
        const quoteVolume = this.safeFloat (ticker, 'quote_volume');
        let vwap = undefined;
        if (quoteVolume !== undefined && baseVolume !== undefined) {
            vwap = quoteVolume / baseVolume;
        }
        return {
            'symbol': symbol,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'high': this.safeFloat (ticker, 'high'),
            'low': this.safeFloat (ticker, 'low'),
            'bid': this.safeFloat (ticker, 'best_bid'),
            'bidVolume': undefined,
            'ask': this.safeFloat (ticker, 'best_ask'),
            'askVolume': undefined,
            'vwap': vwap,
            'open': open,
            'close': last,
            'last': last,
            'previousClose': undefined,
            'change': change,
            'percentage': percentage,
            'average': average,
            'baseVolume': baseVolume,
            'quoteVolume': quoteVolume,
            'info': ticker,
        };
    }

    async fetchTicker (symbol, params = {}) {
        await this.loadMarkets ();
        const market = this.market (symbol);
        const request = {
            'instrument_code': market['id'],
        };
        const response = await this.publicGetMarketTickerInstrumentCode (this.extend (request, params));
        //
        //     {
        //         "instrument_code":"BTC_EUR",
        //         "sequence":602562,
        //         "time":"2020-07-10T06:27:34.951Z",
        //         "state":"ACTIVE",
        //         "is_frozen":0,
        //         "quote_volume":"1695555.1783768",
        //         "base_volume":"205.67436",
        //         "last_price":"8143.91",
        //         "best_bid":"8143.71",
        //         "best_ask":"8156.9",
        //         "price_change":"-147.47",
        //         "price_change_percentage":"-1.78",
        //         "high":"8337.45",
        //         "low":"8110.0"
        //     }
        //
        return this.parseTicker (response, market);
    }

    async fetchTickers (symbols = undefined, params = {}) {
        await this.loadMarkets ();
        const tickers = await this.publicGetMarketTicker (params);
        //
        //     [
        //         {
        //             "instrument_code":"BTC_EUR",
        //             "sequence":602562,
        //             "time":"2020-07-10T06:27:34.951Z",
        //             "state":"ACTIVE",
        //             "is_frozen":0,
        //             "quote_volume":"1695555.1783768",
        //             "base_volume":"205.67436",
        //             "last_price":"8143.91",
        //             "best_bid":"8143.71",
        //             "best_ask":"8156.9",
        //             "price_change":"-147.47",
        //             "price_change_percentage":"-1.78",
        //             "high":"8337.45",
        //             "low":"8110.0"
        //         }
        //     ]
        //
        const result = {};
        for (let i = 0; i < tickers.length; i++) {
            const ticker = this.parseTicker (tickers[i]);
            const symbol = ticker['symbol'];
            result[symbol] = ticker;
        }
        return result;
    }

    async fetchOrderBook (symbol, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const request = {
            'instrument_code': this.marketId (symbol),
            // level 1 means only the best bid and ask
            // level 2 is a compiled order book up to market precision
            // level 3 is a full orderbook
            // if you wish to get regular updates about orderbooks please use the Websocket channel
            // heavy usage of this endpoint may result in limited access according to rate limits rules
            // 'level': 3, // default
        };
        if (limit !== undefined) {
            request['depth'] = limit;
        }
        const response = await this.publicGetOrderBookInstrumentCode (this.extend (request, params));
        //
        // level 1
        //
        //     {
        //         "instrument_code":"BTC_EUR",
        //         "time":"2020-07-10T07:39:06.343Z",
        //         "asks":{
        //             "value":{
        //                 "price":"8145.29",
        //                 "amount":"0.96538",
        //                 "number_of_orders":1
        //             }
        //         },
        //         "bids":{
        //             "value":{
        //                 "price":"8134.0",
        //                 "amount":"1.5978",
        //                 "number_of_orders":5
        //             }
        //         }
        //     }
        //
        // level 2
        //
        //     {
        //         "instrument_code":"BTC_EUR","time":"2020-07-10T07:36:43.538Z",
        //         "asks":[
        //             {"price":"8146.59","amount":"0.89691","number_of_orders":1},
        //             {"price":"8146.89","amount":"1.92062","number_of_orders":1},
        //             {"price":"8169.5","amount":"0.0663","number_of_orders":1},
        //         ],
        //         "bids":[
        //             {"price":"8143.49","amount":"0.01329","number_of_orders":1},
        //             {"price":"8137.01","amount":"5.34748","number_of_orders":1},
        //             {"price":"8137.0","amount":"2.0","number_of_orders":1},
        //         ]
        //     }
        //
        // level 3
        //
        //     {
        //         "instrument_code":"BTC_EUR",
        //         "time":"2020-07-10T07:32:31.525Z",
        //         "bids":[
        //             {"price":"8146.79","amount":"0.01537","order_id":"5d717da1-a8f4-422d-afcc-03cb6ab66825"},
        //             {"price":"8139.32","amount":"3.66009","order_id":"d0715c68-f28d-4cf1-a450-d56cf650e11c"},
        //             {"price":"8137.51","amount":"2.61049","order_id":"085fd6f4-e835-4ca5-9449-a8f165772e60"},
        //         ],
        //         "asks":[
        //             {"price":"8153.49","amount":"0.93384","order_id":"755d3aa3-42b5-46fa-903d-98f42e9ae6c4"},
        //             {"price":"8153.79","amount":"1.80456","order_id":"62034cf3-b70d-45ff-b285-ba6307941e7c"},
        //             {"price":"8167.9","amount":"0.0018","order_id":"036354e0-71cd-492f-94f2-01f7d4b66422"},
        //         ]
        //     }
        //
        const timestamp = this.parse8601 (this.safeString (response, 'time'));
        return this.parseOrderBook (response, timestamp, 'bids', 'asks', 'price', 'amount');
    }

    sign (path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        let url = this.urls['api'][api] + '/' + this.version + '/' + this.implodeParams (path, params);
        if (api === 'public') {
            if (Object.keys (params).length) {
                url += '?' + this.urlencode (params);
            }
        }
        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }
};
