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
