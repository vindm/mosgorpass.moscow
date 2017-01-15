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

        this._onResize = debounce(this._onResize, 100, true, this);
        this._onScroll = debounce(this._onScroll, 500, true, this);
        this._onTouchEnd = this._onTouchEnd.bind(this);
        this._onTouchStart = this._onTouchStart.bind(this);
        this._onWheelScroll = this._onWheelScroll.bind(this);

        this._bindEvents(true);
        this._onResize();

        $win.on('resize', this._onResize);

        $elem.data('pager', this);
    };

    var pager = Pager.prototype;

    pager.step = function(delta) {
        var currentItem = this._currentItem,
            steps = currentItem.steps,
            isDown = delta > 0,
            nextStep,
            step;

        if (steps) {
            step = currentItem.step;
            nextStep = step + (isDown ? 1 : -1);
        }

        if (nextStep >= 0 && nextStep <= steps) {
            currentItem.step = nextStep;

            this._$elem.trigger('change_step', {
                item: currentItem,
                prev: step,
                current: nextStep,
                isLast: nextStep === steps,
                isFirst: nextStep === 0
            });

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
            isDown,
            position,
            currentItem,
            currentPosition;

        if (this.isDisabled || this.scrolling) {
            this._lastScrollDelta = delta;

            return this;
        }

        if (delta === 0) {
            return this;
        }

        isDown = delta > 0;
        currentItem = this._currentItem;
        currentPosition = this._currentPosition;

        if (
            opts.checkSteps && currentPosition === currentItem.start &&
            ( ! opts.checkScroll || this._isRealScroll(delta))
        ) {
            if (this.step(delta)) {
                return this;
            }
        }

        position = currentPosition + delta;

        if (delta > 0 && currentPosition < currentItem.winHeightDiff) {
            position = Math.min(position, currentItem.winHeightDiff);
        }
        if (delta < 0 && currentPosition > currentItem.start) {
            position = Math.max(position, currentItem.start);
        }

        item = this._getItemByPosition(position, isDown ? 'down' : 'up');

        if (item !== currentItem) {
            if ( ! opts.checkScroll || this._isRealScroll(delta)) {
                this._currentPosition = item.start;

                this.goTo(item.index, true);
            }
        } else {
            this._lastScrollDelta = delta;
            this._currentPosition = Math.max(item.start, Math.min(position, item.winHeightDiff));
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
            $slide;

        $.each($items, function(ind, slide) {
            $slide = $(slide);

            _this._itemsCount = _this._items.push({
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
            // prevItem && prevItem.$elem.removeClass('current');

            _this._$elem.trigger('change_start', {
                next: currentItem,
                current: prevItem
            });
        }

        _this
            .moveTo({ to: currentItem.start })
            .then(function() {
                if ( ! isCurrent) {
                    // currentItem.$elem.addClass('current');

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
        this._$elem[isOn ? 'on' : 'off'](true || ('ontouchstart' in doc.documentElement) ?
            {
                touchend: this._onTouchEnd,
                touchstart: this._onTouchStart,
                scroll: function(e) { e.preventDefault(); e.stopPropagation(); return false; }
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
        var touches = event.originalEvent.targetTouches;

        // игнорим если на экране слишком много пальцев
        if (touches && touches.length > 1) {
            return;
        }

        this._touchStart = touches ? touches[0] : event.originalEvent;
    };

    /**
     * @private
     * @param {jQuery.Event} event
     */
    pager._onTouchEnd = function(event) {
        var touches = event.originalEvent.changedTouches,
            currentTouch = touches ? touches[0] : event.originalEvent;

        this.move(this._touchStart.pageY - currentTouch.pageY);

        event.preventDefault();
        event.stopPropagation();

        return false;
    };

    /**
     * @private
     */
    pager._onScroll = function(event) {
        console.error('scroll', event, this._$elem.scrollTop(), this._currentPosition);

        this.move(this._$elem.scrollTop() - this._currentPosition);

        event.preventDefault();
        event.stopPropagation();

        return false;
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
            slide.winHeightDiff = slide.end - winHeight;
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
