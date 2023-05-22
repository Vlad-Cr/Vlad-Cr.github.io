function StereoCamera(  
        Convergence,
        EyeSeparation,
        AspectRatio,
        FOV,
        NearClippingDistance,
        FarClippingDistance
        )
{
    this.Convergence            = Convergence;
    this.EyeSeparation          = EyeSeparation;
    this.AspectRatio            = AspectRatio;
    this.FOV                    = FOV * Math.PI / 180.0;
    this.NearClippingDistance   = NearClippingDistance;
    this.FarClippingDistance    = FarClippingDistance;

    this.Update = function(
        Convergence,
        EyeSeparation,
        FOV,
        NearClippingDistance,
    )
    {
        this.Convergence            = Convergence;
        this.EyeSeparation          = EyeSeparation;
        this.FOV                    = FOV * Math.PI / 180.0;
        this.NearClippingDistance   = NearClippingDistance;
    }

    this.ApplyLeftFrustum = function()
    {
        let top, bottom, left, right;

        top     = this.NearClippingDistance * Math.tan(this.FOV / 2.0);
        bottom  = -top;

        let a = this.AspectRatio * Math.tan(this.FOV / 2.0) * this.Convergence;
        let b = a - this.EyeSeparation / 2.0;
        let c = a + this.EyeSeparation / 2.0;

        left    = -b * this.NearClippingDistance / this.Convergence;
        right   =  c * this.NearClippingDistance / this.Convergence;
 
        // Set the Projection Matrix
        let ProjectionMatrix = m4.frustum(left, right, bottom, top,
            this.NearClippingDistance, this.FarClippingDistance);
 
        // Displace the world to right
        let ViewMatrix = m4.translation(this.EyeSeparation / 2.0, 0.0, 0.0);

        return [ViewMatrix, ProjectionMatrix];
    }

    this.ApplyRightFrustum = function()
    {
        let top, bottom, left, right;

        top     = this.NearClippingDistance * Math.tan(this.FOV / 2.0);
        bottom  = -top;

        let a = this.AspectRatio * Math.tan(this.FOV / 2.0) * this.Convergence;
        let b = a - this.EyeSeparation / 2.0;
        let c = a + this.EyeSeparation / 2.0;
 
        left    =  -c * this.NearClippingDistance / this.Convergence;
        right   =   b * this.NearClippingDistance / this.Convergence;
 
        // Set the Projection Matrix
        let ProjectionMatrix = m4.frustum(left, right, bottom, top,
            this.NearClippingDistance, this.FarClippingDistance);
 
        // Displace the world to left
        let ViewMatrix = m4.translation(-this.EyeSeparation / 2.0, 0.0, 0.0);

        return [ViewMatrix, ProjectionMatrix];
    }
} 
