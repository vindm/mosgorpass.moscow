(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
require('./lib/pager');

$(function() {
    var $pager = $('.pager'),
        $video = $('.pager__page').eq(0),
        $screens = $('.screens'),
        $screensImages = $('.screens__images'),
        video = $video.data('vide').getVideoObject(),
        pager;

    $pager.pager();
    pager = $pager.data('pager');

    $pager
        .on('change_start', function() {
            video.pause();
        })
        .on('change_done', function(e, data) {
            if (data.current.$elem.is($video)) {
                video.play();
            }
        })
        .on('change_step', function(e, data) {
            pager.disable();

            $screens
                .removeClass('screens_step_' + data.prev)
                .addClass('screens_step_' + data.current);

            $screensImages
                .css('transform', 'translate3d(0, ' + data.current * -10 + '%, 0)');

            setTimeout(function() {
                pager.enable();
            }, data.isFirst || data.isLast ? 1100 : 900);
        });

});

},{"./lib/pager":3}],2:[function(require,module,exports){
module.exports = function(fn, timeout, invokeAsap, ctx) {
    if(arguments.length == 3 && typeof invokeAsap != 'boolean') {
        ctx = invokeAsap;
        invokeAsap = false;
    }

    var timer;

    return function() {

        var args = arguments;
        ctx = ctx || this;

        invokeAsap && !timer && fn.apply(ctx, args);

        clearTimeout(timer);

        timer = setTimeout(function() {
            invokeAsap || fn.apply(ctx, args);
            timer = null;
        }, timeout);

    };
};

},{}],3:[function(require,module,exports){
var debounce = require('./debounce'),
    scroll = require('./scroll');

(function(doc, win, $, undefined) {
    var $win = $(win);

    var Pager = function(elem) {
        var $elem = $(elem),
            $movable = $elem.find('.pager__movable');

        if ($movable.length === 0) {
            $movable = $elem;
        }

        this._$elem = $elem;
        this._items = [];
        this._itemsCount = 0;
        this._currentItem = null;

        this.addItems($movable.children('article'));

        this._onResize = debounce(this._onResize, 100, this);
        this._onScroll = debounce(this._onScroll, 500, this);
        this._onTouchEnd = this._onTouchEnd.bind(this);
        this._onTouchStart = this._onTouchStart.bind(this);
        this._onWheelScroll = this._onWheelScroll.bind(this);

        this._bindEvents(true);
        this._onResize();

        $win.on('resize', this._onResize);

        $elem.data('pager', this);
    };

    var pager = Pager.prototype;

    pager.stepMove = function(delta, options) {
        var opts = options || {},
            currentItem,
            step,
            steps,
            nextStep;

        currentItem = this._currentItem;

        if (this._currentPosition === currentItem.start) {
            steps = currentItem.steps;
        }

        if (steps) {
            step = currentItem.step;
            nextStep = step + (delta > 0 ? 1 : -1);
        }

        if (nextStep >= 0 && nextStep < steps) {
            if ( ! opts.checkScroll || this._isRealScroll(delta)) {
                currentItem.step = nextStep;

                this._$elem.trigger('change_step', {
                    item: currentItem,
                    prev: step,
                    current: nextStep,
                    isLast: nextStep === steps - 1,
                    isFirst: nextStep === 0
                });
            }

            return this;
        }
    };

    /**
     * @param {Number} delta
     * @param {Object} [options]
     * @returns {Pager}
     */
    pager.move = function(delta, options) {
        var opts = options || {},
            item,
            step,
            steps,
            position,
            nextStep,
            currentItem;

        if (this.isDisabled || this.scrolling) {
            this._lastScrollDelta = delta;

            return this;
        }

        if (delta === 0) {
            return this;
        }

        currentItem = this._currentItem;

        if (opts.checkSteps && this._currentPosition === currentItem.start) {
            steps = currentItem.steps;
        }

        if (steps) {
            step = currentItem.step;
            nextStep = step + (delta > 0 ? 1 : -1);
        }

        if (nextStep >= 0 && nextStep <= steps - 1) {
            if ( ! opts.checkScroll || this._isRealScroll(delta)) {
                currentItem.step = nextStep;

                this._$elem.trigger('change_step', {
                    item: currentItem,
                    prev: step,
                    current: nextStep,
                    isLast: nextStep === steps - 1,
                    isFirst: nextStep === 0
                });
            }

            return this;
        }

        position = this._currentPosition + delta;

        if (delta > 0 && this._currentPosition < (currentItem.end - this.winSize.height)) {
            position = Math.min(position, currentItem.end - this.winSize.height);
        }
        if (delta < 0 && this._currentPosition > currentItem.start) {
            position = Math.max(position, currentItem.start);
        }

        item = this._getItemByPosition(position, delta > 0 ? 'down' : 'up');

        if (item !== currentItem) {
            if ( ! opts.checkScroll || this._isRealScroll(delta)) {
                this._currentPosition = item.start;

                this.goTo(item.index, true);
            }
        } else {
            this._lastScrollDelta = delta;
            this._currentPosition = Math.max(item.start, Math.min(position, item.end - this.winSize.height));
            this._currentItem = item;
            this.moveTo({
                to: this._currentPosition,
                duration: 0
            });
        }

        return this;
    };

    /**
     * @returns {Pager}
     */
    pager.prev = function() {
        this.goTo(this._currentItem ? this._currentItem.index - 1 : 0);

        return this;
    };

    /**
     * @returns {Pager}
     */
    pager.next = function() {
        this.goTo(this._currentItem ? this._currentItem.index + 1 : 0);

        return this;
    };

    /**
     * @returns {Pager}
     */
    pager.goTo = function(itemIndex, isForce) {
        var currentItem = this.getItem(itemIndex);

        if (currentItem) {
            this.setCurrentItem(currentItem, isForce);
        }

        return this;
    };

    /**
     * @param {jQuery} $items
     * @returns {Pager}
     */
    pager.addItems = function($items) {
        var _this = this,
            id = _this.id,
            $slide,
            slideId;

        $.each($items, function(ind, slide) {
            $slide = $(slide);
            slideId = $slide.attr('id') || ('slide' + ind + 1);
            $slide.attr('id', id + '_' + slideId);

            _this._itemsCount = _this._items.push({
                id: slideId,
                index: ind,
                step: parseInt($slide.data('step'), 10) || 0,
                steps: parseInt($slide.data('steps'), 10) || 0,
                $elem: $slide
            });
        });

        return _this;
    };

    /**
     * @param {Number|String} [itemIndex]
     * @returns {?Object}
     */
    pager.getItem = function(itemIndex) {
        var index = false;

        if (typeof itemIndex === 'string') {
            this._items.some(function(slide, ind) {
                if (slide.id === itemIndex) {
                    index = ind;

                    return false;
                }
            });
        }

        if ($.isNumeric(itemIndex)) {
            index = itemIndex > -1 && itemIndex < this._itemsCount && itemIndex;
        } else if ( ! itemIndex) {
            index = this._currentItem && this._currentItem.index;
        }

        return $.isNumeric(index) ?
            this._items[index] :
            null;
    };

    /**
     * @param {String} [direction]
     * @returns {Pager}
     */
    pager.updatePosition = function(direction) {
        var item = this._getItemByPosition(this._currentPosition, direction);

        if (item !== this._currentItem) {
            this.goTo(item.index, true);
        }

        return this;
    };

    /**
     * @param {Object} currentItem
     * @param {Boolean} [isForce]
     * @returns {Pager}
     */
    pager.setCurrentItem = function(currentItem, isForce) {
        var _this = this,
            prevItem = _this._currentItem,
            isCurrent = currentItem === prevItem;

        if ( ! isForce && isCurrent) {
            return this;
        }

        if ( ! isCurrent) {
            prevItem && prevItem.$elem.removeClass('current');

            _this._$elem.trigger('change_start', {
                next: currentItem,
                current: prevItem
            });
        }

        _this
            .moveTo({ to: currentItem.start })
            .then(function() {
                if ( ! isCurrent) {
                    currentItem.$elem.addClass('current');

                    _this._currentItem = currentItem;
                    _this._$elem
                        .trigger('change_done', {
                            prev: prevItem,
                            current: currentItem
                        });
                }
            });

        return this;
    };

    /**
     * @param {Object} opts
     * @return {?jQuery.Deferred}
     */
    pager.moveTo = function(opts) {
        var _this = this;

        if (_this.scrolling) {
            _this.scrolling.reject();
        }

        _this.scrolling = scroll(_this._$elem, opts);

        _this.scrolling
            .always(function() {
                setTimeout(function() {
                    _this.scrolling = null;
                }, 0);
            });

        return _this.scrolling;
    };

    pager.disable = function() {
        this.isDisabled = true;
    };

    pager.enable = function() {
        this.isDisabled = false;
    };

    /**
     * @private
     * @param {Number} [position] Позиция
     * @param {String} [direction] Направление
     * @returns {?Object} Айтем, соответствующий позиции
     */
    pager._getItemByPosition = function(position, direction) {
        var start = position || this._currentPosition,
            end = start + this.winSize.height,
            items = this._items,
            itemsLen = this._itemsCount,
            checkingIndex = 0,
            offset,
            item;

        while ((item = items[checkingIndex++])) {
            offset = start - item.start;

            if ( ! direction) {
                if (item.height / 2 >= offset) {
                    break;
                }
            } else {
                if (direction === 'down' && item.start <= end && item.end >= end) {
                    break;
                }

                if (direction === 'up' && item.end > start) {
                    break;
                }
            }
        }

        if ( ! item) {
            item = direction === 'down' ? items[itemsLen - 1] : items[0];
        }

        return item;
    };

    /**
     * @private
     * @param {Boolean} isOn
     */
    pager._bindEvents = function(isOn) {
        this._$elem[isOn ? 'on' : 'off']('ontouchstart' in doc.documentElement ?
            {
                touchend: this._onTouchEnd,
                touchstart: this._onTouchStart
            } :
            {
                wheel: this._onWheelScroll,
                scroll: this._onScroll
            });

        $('.pager__nav_dir_next').click(this.next.bind(this));
        $('.pager__nav_dir_prev').click(this.prev.bind(this));
    };

    /**
     * @private
     * @param {Number} newDelta
     * @returns {Bboolean}
     */
    pager._isRealScroll = function(newDelta) {
        var oldDelta = this._lastScrollDelta,
            isRealScroll = false;

        if (oldDelta !== null) {
            // different direction
            if (oldDelta < 0 && newDelta > 0) {
                isRealScroll = true;
            }
            if (oldDelta > 0 && newDelta < 0) {
                isRealScroll = true;
            }
            // same direction
            if (oldDelta > 0 && newDelta > 0) {
                isRealScroll = oldDelta < newDelta;
            }
            if (oldDelta < 0 && newDelta < 0) {
                isRealScroll = oldDelta > newDelta;
            }
        } else {
            isRealScroll = true;
        }

        this._lastScrollDelta = newDelta;

        return isRealScroll;
    };

    /**
     * @private
     * @param {jQuery.Event} event
     */
    pager._onWheelScroll = function(event) {
        var e = event.originalEvent || window.event;

        if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) {
            return;
        }

        this.move(e.deltaY, {
            checkScroll: true,
            checkSteps: true
        });

        event.preventDefault();
        event.stopPropagation();

        return false;
    };

    /**
     * @private
     * @param {jQuery.Event} event
     */
    pager._onTouchStart = function(event) {
        this._touchStartY = event.originalEvent.touches[0].pageY;
    };

    /**
     * @private
     * @param {jQuery.Event} event
     */
    pager._onTouchEnd = function(event) {
        this.move(this._touchStartY - event.originalEvent.changedTouches[0].pageY);

        event.preventDefault();
        event.stopPropafation();

        return false;
    };

    /**
     * @private
     */
    pager._onScroll = function() {
        this.move(this._$elem.scrollTop() - this._currentPosition);
    };

    /**
     * @private
     */
    pager._onResize = function() {
        var winHeight = $win.height(),
            lastEnd = 0;

        this._items.forEach(function(slide) {
            slide.height = slide.$elem.outerHeight();
            slide.start = lastEnd;
            slide.end = (lastEnd += slide.height);
        });

        this.winSize || (this.winSize = {});
        this.winSize.height = winHeight;

        this._currentPosition = this._$elem.scrollTop();

        this.updatePosition();
    };

    $.fn.pager = function(options) {
        this.each(function(ind, elem) {
            /* jshint -W031 */
            new Pager(elem, options);
        });
    };

})(document, window, jQuery);

},{"./debounce":2,"./scroll":4}],4:[function(require,module,exports){
module.exports = function($elem, options) {
    var opts = options || {},
        to = parseInt(options.to, 10),
        duration = parseInt(opts.duration, 10),
        deff = $.Deferred(),
        easing;

    if (isNaN(duration)) {
        duration = Math.sqrt(Math.abs($elem.scrollTop() - to)) * 40;
    }

    if (duration > 0) {
        easing = opts.easing;

        if (typeof easing !== 'string') {
            easing = 'easeOutCubic';
        }
        if (typeof $.easing[easing] !== 'function') {
            easing = 'linear';
        }
    }

    $elem
        .stop()
        .animate(
            { scrollTop: to },
            {
                duration: duration,
                easing: easing,
                queue: false,
                done: function() {
                    deff.resolve();
                }
            });

    return deff;
};

},{}]},{},[1])

//# sourceMappingURL=bundle.js.map
